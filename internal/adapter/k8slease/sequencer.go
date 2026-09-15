package k8slease

import (
	"context"
	"fmt"
	"math"
	"strconv"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	v1 "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/util/retry"
)

const (
	// DefaultSequencerName is the fixed ConfigMap provisioned by the mecak8s
	// chart for durable fencing-token allocation.
	DefaultSequencerName = "mecatl-lease-fencing-sequence"
	sequenceDataKey      = "last-token"
)

// BootstrapSequencer creates the durable fencing-token sequence at the legacy
// token floor. If another installer already created it, BootstrapSequencer
// validates the existing value without changing it. It never repairs or resets
// existing state because doing so could allow a stale lease holder to fence a
// newer one.
func BootstrapSequencer(ctx context.Context, clientset kubernetes.Interface, namespace, name string) error {
	configMaps := clientset.CoreV1().ConfigMaps(namespace)
	seed := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Data: map[string]string{
			sequenceDataKey: strconv.FormatUint(uint64(math.MaxInt32), 10),
		},
	}
	if _, err := configMaps.Create(ctx, seed, metav1.CreateOptions{}); err == nil {
		return nil
	} else if !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("k8slease: create fencing sequencer ConfigMap %q: %w", name, err)
	}

	existing, err := configMaps.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("k8slease: get existing fencing sequencer ConfigMap %q: %w", name, err)
	}
	if _, err := parseSequenceValue(existing, name); err != nil {
		return err
	}
	return nil
}

func parseSequenceValue(cm *corev1.ConfigMap, name string) (uint64, error) {
	raw, ok := cm.Data[sequenceDataKey]
	if !ok {
		return 0, fmt.Errorf("k8slease: fencing sequencer ConfigMap %q is missing data key %q", name, sequenceDataKey)
	}
	last, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("k8slease: fencing sequencer value %q is malformed: %w", raw, err)
	}
	if last < uint64(math.MaxInt32) {
		return 0, fmt.Errorf("k8slease: fencing sequencer value %d is below the legacy-token floor %d", last, math.MaxInt32)
	}
	if last == math.MaxUint64 {
		return 0, fmt.Errorf("k8slease: fencing sequencer is exhausted at %d", last)
	}
	return last, nil
}

// sequencer allocates fencing tokens from a pre-provisioned, non-GC state
// object. The ConfigMap is deliberately never created here: disappearance is
// indistinguishable from loss of fencing history and therefore fails closed.
type sequencer struct {
	configMaps v1.ConfigMapInterface
	name       string
}

func (s sequencer) next(ctx context.Context) (uint64, error) {
	var allocated uint64
	err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		cm, err := s.configMaps.Get(ctx, s.name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return fmt.Errorf("k8slease: fencing sequencer ConfigMap %q is missing", s.name)
		}
		if err != nil {
			return fmt.Errorf("k8slease: get fencing sequencer: %w", err)
		}
		last, err := parseSequenceValue(cm, s.name)
		if err != nil {
			return err
		}
		allocated = last + 1
		next := cm.DeepCopy()
		if next.Data == nil {
			next.Data = make(map[string]string, 1)
		}
		next.Data[sequenceDataKey] = strconv.FormatUint(allocated, 10)
		if _, err := s.configMaps.Update(ctx, next, metav1.UpdateOptions{}); err != nil {
			if apierrors.IsConflict(err) {
				return err
			}
			return fmt.Errorf("k8slease: update fencing sequencer: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return allocated, nil
}
