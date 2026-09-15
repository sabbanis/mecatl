package k8slease

import (
	"context"
	"math"
	"strconv"
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestBootstrapSequencer_CreatesSequenceAtLegacyFloor(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset()

	if err := BootstrapSequencer(ctx, cs, testNamespace, DefaultSequencerName); err != nil {
		t.Fatalf("BootstrapSequencer: %v", err)
	}
	created, err := cs.CoreV1().ConfigMaps(testNamespace).Get(ctx, DefaultSequencerName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get created ConfigMap: %v", err)
	}
	if got, want := created.Data[sequenceDataKey], strconv.FormatUint(uint64(math.MaxInt32), 10); got != want {
		t.Fatalf("created sequence = %q, want %q", got, want)
	}
	for _, action := range cs.Actions() {
		if action.GetResource().Resource == "configmaps" && action.GetVerb() == "update" {
			t.Fatal("bootstrap updated the sequencer")
		}
	}
}

func TestBootstrapSequencer_ExistingAdvancedSequenceIsUnchanged(t *testing.T) {
	ctx := context.Background()
	want := strconv.FormatUint(uint64(math.MaxInt32)+99, 10)
	cs := fake.NewSimpleClientset(sequenceConfigMap(want))

	if err := BootstrapSequencer(ctx, cs, testNamespace, DefaultSequencerName); err != nil {
		t.Fatalf("BootstrapSequencer: %v", err)
	}
	existing, err := cs.CoreV1().ConfigMaps(testNamespace).Get(ctx, DefaultSequencerName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get existing ConfigMap: %v", err)
	}
	if got := existing.Data[sequenceDataKey]; got != want {
		t.Fatalf("existing sequence = %q, want unchanged %q", got, want)
	}
	for _, action := range cs.Actions() {
		if action.GetResource().Resource == "configmaps" && action.GetVerb() == "update" {
			t.Fatal("bootstrap repaired or reset existing state")
		}
	}
}

func TestBootstrapSequencer_RejectsInvalidExistingStateWithoutRepair(t *testing.T) {
	tests := []struct {
		name string
		cm   *corev1.ConfigMap
		want string
	}{
		{
			name: "missing key",
			cm:   &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: DefaultSequencerName, Namespace: testNamespace}},
			want: "missing data key",
		},
		{name: "malformed", cm: sequenceConfigMap("not-a-number"), want: "malformed"},
		{name: "below floor", cm: sequenceConfigMap("7"), want: "below the legacy-token floor"},
		{name: "exhausted", cm: sequenceConfigMap(strconv.FormatUint(math.MaxUint64, 10)), want: "exhausted"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			before := tt.cm.DeepCopy()
			cs := fake.NewSimpleClientset(tt.cm)

			err := BootstrapSequencer(ctx, cs, testNamespace, DefaultSequencerName)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("BootstrapSequencer error = %v, want containing %q", err, tt.want)
			}
			after, getErr := cs.CoreV1().ConfigMaps(testNamespace).Get(ctx, DefaultSequencerName, metav1.GetOptions{})
			if getErr != nil {
				t.Fatalf("get existing ConfigMap: %v", getErr)
			}
			if got, want := after.Data[sequenceDataKey], before.Data[sequenceDataKey]; got != want {
				t.Fatalf("invalid sequence changed from %q to %q", want, got)
			}
			for _, action := range cs.Actions() {
				if action.GetResource().Resource == "configmaps" && action.GetVerb() == "update" {
					t.Fatal("bootstrap repaired invalid existing state")
				}
			}
		})
	}
}
