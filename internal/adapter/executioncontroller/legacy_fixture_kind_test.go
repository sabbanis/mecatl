//go:build kind_execution_e2e

package executioncontroller

import (
	"context"
	"errors"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	kubefake "k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"

	"github.com/stacklok/mecatl/internal/executionenv"
)

func TestLegacyFixtureWaitsForQuotaAccountingBeforeCreate(t *testing.T) {
	for _, mode := range []string{"delayed", "timeout", "cancel", "forbidden"} {
		t.Run(mode, func(t *testing.T) {
			quota := &corev1.ResourceQuota{ObjectMeta: metav1.ObjectMeta{Name: "mecatl-execution", Namespace: "test"}, Spec: corev1.ResourceQuotaSpec{Hard: corev1.ResourceList{corev1.ResourceName("count/executionenvironments.execution.mecatl.dev"): resource.MustParse("10"), corev1.ResourcePods: resource.MustParse("10")}}}
			kube := kubefake.NewClientset()
			reads, creates := 0, 0
			ctx, cancel := context.WithTimeout(context.Background(), 350*time.Millisecond)
			defer cancel()
			kube.PrependReactor("get", "resourcequotas", func(ktesting.Action) (bool, runtime.Object, error) {
				reads++
				if mode == "forbidden" {
					return true, nil, apierrors.NewForbidden(schema.GroupResource{Resource: "resourcequotas"}, quota.Name, errors.New("denied"))
				}
				// Partially initialized status must not pass: all configured resources matter.
				quota.Status.Hard = quota.Spec.Hard.DeepCopy()
				quota.Status.Used = corev1.ResourceList{corev1.ResourcePods: resource.MustParse("0")}
				if mode == "delayed" && reads >= 2 {
					quota.Status.Used = quota.Spec.Hard.DeepCopy()
				}
				if mode == "cancel" {
					cancel()
				}
				return true, quota.DeepCopy(), nil
			})
			d := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
			stop := errors.New("create reached")
			d.PrependReactor("create", "executionenvironments", func(ktesting.Action) (bool, runtime.Object, error) {
				creates++
				if reads < 2 || mode != "delayed" {
					t.Error("create before quota accounting initialized")
				}
				return true, nil, stop
			})
			_, err := seedOneLegacyEnvironment(ctx, d, kube, "test", resolvedProfile{}, executionenv.Owner{}, "client", "legacy", "binding", nil, false)
			if mode == "delayed" {
				if !errors.Is(err, stop) || creates != 1 {
					t.Fatalf("creates=%d reads=%d error=%v", creates, reads, err)
				}
				return
			}
			if err == nil || creates != 0 {
				t.Fatalf("creates=%d error=%v", creates, err)
			}
			switch mode {
			case "timeout":
				if !errors.Is(err, context.DeadlineExceeded) {
					t.Fatal(err)
				}
			case "cancel":
				if !errors.Is(err, context.Canceled) {
					t.Fatal(err)
				}
			case "forbidden":
				if !apierrors.IsForbidden(err) || reads != 1 {
					t.Fatalf("reads=%d error=%v", reads, err)
				}
			}
		})
	}
}
