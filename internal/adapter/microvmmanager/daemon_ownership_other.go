//go:build !linux

package microvmmanager

func daemonOwnershipHeld(string) (bool, error) { return false, nil }
