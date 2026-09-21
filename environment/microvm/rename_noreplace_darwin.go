//go:build darwin

package microvm

import "errors"

func renameatNoReplace(_ int, _ string, _ int, _ string) error {
	return errors.New("atomic no-overwrite rename is unsupported on this platform")
}
