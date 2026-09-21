package redisstore

import (
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestRedisFollowCapacity_ProductionClientUsesDedicatedBoundedPool(t *testing.T) {
	server := miniredis.RunT(t)
	store, err := NewWithConfig(Config{Addr: server.Addr(), AllowPlaintext: true, FollowPoolSize: 2, MaxFollowers: 2})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })

	durability, ok := store.testClient().(*redis.Client)
	if !ok {
		t.Fatalf("durability client = %T, want *redis.Client", store.testClient())
	}
	follow, ok := store.testFollowClient().(*redis.Client)
	if !ok {
		t.Fatalf("follow client = %T, want *redis.Client", store.testFollowClient())
	}
	if durability == follow {
		t.Fatal("durability and follow traffic share one client")
	}
	if opts := follow.Options(); opts.PoolSize != 2 || opts.MaxActiveConns != 2 {
		t.Fatalf("follow pool limits = %d/%d, want 2/2", opts.PoolSize, opts.MaxActiveConns)
	}
}
