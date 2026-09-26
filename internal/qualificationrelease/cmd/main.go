// Package main provides the repository-internal qualification manifest tool.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/stacklok/mecatl/internal/qualificationrelease"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "qualification-release:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("expected generate or verify")
	}
	fs := flag.NewFlagSet(args[0], flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts qualificationrelease.Options
	fs.StringVar(&opts.DistDir, "dist", "dist/qualification", "qualification artifact directory")
	fs.StringVar(&opts.Tag, "tag", "", "exact v0.0.39-i2i.N tag")
	fs.StringVar(&opts.SourceCommit, "commit", "", "full source commit")
	fs.BoolVar(&opts.RequireSBOMs, "require-sboms", true, "require one SPDX JSON SBOM per archive")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected positional arguments: %v", fs.Args())
	}
	switch args[0] {
	case "generate":
		if err := qualificationrelease.Generate(opts); err != nil {
			return err
		}
	case "verify":
		if err := qualificationrelease.Verify(opts); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown command %q; expected generate or verify", args[0])
	}
	return nil
}
