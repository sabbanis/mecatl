// Package qualificationrelease builds and verifies the fork-only qualification
// manifest that binds release archives to the executable bytes consumers run.
package qualificationrelease

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
)

const (
	manifestFilename  = "qualification-manifest.json"
	checksumsFilename = "checksums.txt"
	requiredBaseline  = "a607746a59b1ad61ac2331db7827b31b0a03919d"
)

var tagPattern = regexp.MustCompile(`^v0\.0\.39-i2i\.[1-9][0-9]*$`)

type targetID struct {
	goos   string
	goarch string
}

var requiredTargets = []targetID{
	{goos: "darwin", goarch: "amd64"},
	{goos: "darwin", goarch: "arm64"},
	{goos: "linux", goarch: "amd64"},
	{goos: "linux", goarch: "arm64"},
}

// Manifest is the canonical machine-readable qualification binding.
type Manifest struct {
	SchemaVersion         int      `json:"schema_version"`
	Tag                   string   `json:"tag"`
	SourceCommit          string   `json:"source_commit"`
	RequiredBaseline      string   `json:"required_baseline"`
	BuildID               string   `json:"build_id"`
	ProductMetricsEnabled bool     `json:"product_metrics_enabled"`
	Targets               []Target `json:"targets"`
}

// Target binds one release archive and its extracted mecated executable.
type Target struct {
	GOOS         string `json:"goos"`
	GOARCH       string `json:"goarch"`
	Archive      string `json:"archive"`
	ArchiveSHA   string `json:"archive_sha256"`
	BinarySHA256 string `json:"binary_sha256"`
}

// Options selects the exact release identity and whether archive SBOMs are
// mandatory. Offline snapshots may omit SBOM generation; tagged CI may not.
type Options struct {
	DistDir      string
	Tag          string
	SourceCommit string
	RequireSBOMs bool
}

// Generate verifies the archive set, emits the canonical manifest, and writes
// checksums covering archives, optional SBOMs, and the manifest.
func Generate(opts Options) error {
	if err := validateOptions(opts); err != nil {
		return err
	}
	if err := rejectUnexpectedArchives(opts.DistDir, opts.Tag); err != nil {
		return err
	}

	manifest := Manifest{
		SchemaVersion:         1,
		Tag:                   opts.Tag,
		SourceCommit:          opts.SourceCommit,
		RequiredBaseline:      requiredBaseline,
		BuildID:               opts.Tag,
		ProductMetricsEnabled: false,
		Targets:               make([]Target, 0, len(requiredTargets)),
	}
	payloads := make([]string, 0, len(requiredTargets)*2+1)
	for _, id := range requiredTargets {
		archive := archiveName(opts.Tag, id)
		archivePath := filepath.Join(opts.DistDir, archive)
		archiveSHA, err := hashFile(archivePath)
		if err != nil {
			return fmt.Errorf("hash archive %s: %w", archive, err)
		}
		binary, err := inspectArchive(archivePath)
		if err != nil {
			return fmt.Errorf("inspect archive %s: %w", archive, err)
		}
		manifest.Targets = append(manifest.Targets, Target{
			GOOS:         id.goos,
			GOARCH:       id.goarch,
			Archive:      archive,
			ArchiveSHA:   archiveSHA,
			BinarySHA256: binary.sha256,
		})
		payloads = append(payloads, archivePath)

		sbomPath := archivePath + ".spdx.json"
		if _, err := os.Stat(sbomPath); err == nil {
			payloads = append(payloads, sbomPath)
		} else if opts.RequireSBOMs {
			return fmt.Errorf("required SBOM %s: %w", filepath.Base(sbomPath), err)
		} else if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("inspect optional SBOM %s: %w", filepath.Base(sbomPath), err)
		}
	}

	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal manifest: %w", err)
	}
	manifestBytes = append(manifestBytes, '\n')
	manifestPath := filepath.Join(opts.DistDir, manifestFilename)
	if err := os.WriteFile(manifestPath, manifestBytes, 0o644); err != nil {
		return fmt.Errorf("write manifest: %w", err)
	}
	payloads = append(payloads, manifestPath)
	return writeChecksums(filepath.Join(opts.DistDir, checksumsFilename), payloads)
}

// Verify independently recomputes every archive/binary digest and validates
// the exact checksum subject set. It executes --version only for the host target.
func Verify(opts Options) error {
	if err := validateOptions(opts); err != nil {
		return err
	}
	raw, err := os.ReadFile(filepath.Join(opts.DistDir, manifestFilename))
	if err != nil {
		return fmt.Errorf("read manifest: %w", err)
	}
	var manifest Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return fmt.Errorf("decode manifest: %w", err)
	}
	if err := verifyManifestIdentity(manifest, opts); err != nil {
		return err
	}
	if err := rejectUnexpectedArchives(opts.DistDir, opts.Tag); err != nil {
		return err
	}

	payloads := make([]string, 0, len(requiredTargets)*2+1)
	for i, id := range requiredTargets {
		targetPayloads, err := verifyTarget(opts, id, manifest.Targets[i])
		if err != nil {
			return fmt.Errorf("target %d: %w", i, err)
		}
		payloads = append(payloads, targetPayloads...)
	}
	payloads = append(payloads, filepath.Join(opts.DistDir, manifestFilename))
	return verifyChecksums(filepath.Join(opts.DistDir, checksumsFilename), payloads)
}

func verifyManifestIdentity(manifest Manifest, opts Options) error {
	if manifest.SchemaVersion != 1 || manifest.Tag != opts.Tag ||
		manifest.SourceCommit != opts.SourceCommit ||
		manifest.RequiredBaseline != requiredBaseline || manifest.BuildID != opts.Tag ||
		manifest.ProductMetricsEnabled || len(manifest.Targets) != len(requiredTargets) {
		return errors.New("manifest identity or posture does not match the qualification contract")
	}
	return nil
}

func verifyTarget(opts Options, id targetID, got Target) ([]string, error) {
	wantName := archiveName(opts.Tag, id)
	if got.GOOS != id.goos || got.GOARCH != id.goarch || got.Archive != wantName {
		return nil, errors.New("target does not match required order or archive name")
	}
	archivePath := filepath.Join(opts.DistDir, wantName)
	archiveSHA, err := hashFile(archivePath)
	if err != nil {
		return nil, fmt.Errorf("hash archive %s: %w", wantName, err)
	}
	binary, err := inspectArchive(archivePath)
	if err != nil {
		return nil, fmt.Errorf("inspect archive %s: %w", wantName, err)
	}
	if got.ArchiveSHA != archiveSHA || got.BinarySHA256 != binary.sha256 {
		return nil, fmt.Errorf("manifest digest mismatch for %s", wantName)
	}
	if id.goos == runtime.GOOS && id.goarch == runtime.GOARCH {
		if err := verifyNativeVersion(binary.contents, opts.Tag); err != nil {
			return nil, fmt.Errorf("verify native %s: %w", wantName, err)
		}
	}
	payloads := []string{archivePath}
	sbomPath := archivePath + ".spdx.json"
	if _, err := os.Stat(sbomPath); err == nil {
		payloads = append(payloads, sbomPath)
	} else if opts.RequireSBOMs {
		return nil, fmt.Errorf("required SBOM %s: %w", filepath.Base(sbomPath), err)
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("inspect optional SBOM %s: %w", filepath.Base(sbomPath), err)
	}
	return payloads, nil
}

func validateOptions(opts Options) error {
	if !tagPattern.MatchString(opts.Tag) {
		return fmt.Errorf("tag %q does not match v0.0.39-i2i.N", opts.Tag)
	}
	if !regexp.MustCompile(`^[0-9a-f]{40}$`).MatchString(opts.SourceCommit) {
		return fmt.Errorf("source commit %q is not a full lowercase SHA-1", opts.SourceCommit)
	}
	if opts.DistDir == "" {
		return errors.New("dist directory is required")
	}
	return nil
}

func archiveName(tag string, id targetID) string {
	version := strings.TrimPrefix(tag, "v")
	return fmt.Sprintf("mecated_%s_%s_%s.tar.gz", version, id.goos, id.goarch)
}

func rejectUnexpectedArchives(distDir, tag string) error {
	matches, err := filepath.Glob(filepath.Join(distDir, "*.tar.gz"))
	if err != nil {
		return fmt.Errorf("list archives: %w", err)
	}
	want := make(map[string]struct{}, len(requiredTargets))
	for _, id := range requiredTargets {
		want[archiveName(tag, id)] = struct{}{}
	}
	if len(matches) != len(want) {
		return fmt.Errorf("expected %d archives, found %d", len(want), len(matches))
	}
	for _, match := range matches {
		if _, ok := want[filepath.Base(match)]; !ok {
			return fmt.Errorf("unexpected archive %s", filepath.Base(match))
		}
	}
	return nil
}

type binaryEvidence struct {
	sha256   string
	contents []byte
}

func inspectArchive(path string) (binaryEvidence, error) {
	f, err := os.Open(path)
	if err != nil {
		return binaryEvidence{}, err
	}
	defer func() { _ = f.Close() }()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return binaryEvidence{}, err
	}
	defer func() { _ = gz.Close() }()

	found := map[string]bool{"LICENSE": false, "mecated": false}
	var binary []byte
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return binaryEvidence{}, err
		}
		if hdr.Typeflag != tar.TypeReg {
			return binaryEvidence{}, fmt.Errorf("unexpected non-regular archive entry %q", hdr.Name)
		}
		if _, ok := found[hdr.Name]; !ok || found[hdr.Name] {
			return binaryEvidence{}, fmt.Errorf("unexpected or duplicate archive entry %q", hdr.Name)
		}
		found[hdr.Name] = true
		if hdr.Name == "mecated" {
			binary, err = io.ReadAll(tr)
			if err != nil {
				return binaryEvidence{}, err
			}
		}
	}
	if !found["LICENSE"] || !found["mecated"] || len(binary) == 0 {
		return binaryEvidence{}, errors.New("archive must contain exactly LICENSE and non-empty mecated")
	}
	sum := sha256.Sum256(binary)
	return binaryEvidence{sha256: hex.EncodeToString(sum[:]), contents: binary}, nil
}

func verifyNativeVersion(binary []byte, tag string) error {
	dir, err := os.MkdirTemp("", "mecated-qualification-verify-")
	if err != nil {
		return err
	}
	defer func() { _ = os.RemoveAll(dir) }()
	path := filepath.Join(dir, "mecated")
	if err := os.WriteFile(path, binary, 0o700); err != nil {
		return err
	}
	out, err := exec.Command(path, "--version").CombinedOutput()
	if err != nil {
		return fmt.Errorf("run --version: %w: %s", err, strings.TrimSpace(string(out)))
	}
	if strings.TrimSpace(string(out)) != "mecated "+tag {
		return fmt.Errorf("version output %q does not equal %q", strings.TrimSpace(string(out)), "mecated "+tag)
	}
	return nil
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer func() { _ = f.Close() }()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func writeChecksums(path string, payloads []string) error {
	sort.Slice(payloads, func(i, j int) bool { return filepath.Base(payloads[i]) < filepath.Base(payloads[j]) })
	var b strings.Builder
	for _, payload := range payloads {
		sum, err := hashFile(payload)
		if err != nil {
			return fmt.Errorf("hash payload %s: %w", filepath.Base(payload), err)
		}
		fmt.Fprintf(&b, "%s  %s\n", sum, filepath.Base(payload))
	}
	if err := os.WriteFile(path, []byte(b.String()), 0o644); err != nil {
		return fmt.Errorf("write checksums: %w", err)
	}
	return nil
}

func verifyChecksums(path string, payloads []string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("read checksums: %w", err)
	}
	defer func() { _ = f.Close() }()
	got := make(map[string]string)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) != 2 || len(fields[0]) != sha256.Size*2 {
			return fmt.Errorf("invalid checksum line %q", scanner.Text())
		}
		if _, duplicate := got[fields[1]]; duplicate {
			return fmt.Errorf("duplicate checksum for %s", fields[1])
		}
		got[fields[1]] = fields[0]
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	if len(got) != len(payloads) {
		return fmt.Errorf("checksum subject count %d does not equal payload count %d", len(got), len(payloads))
	}
	for _, payload := range payloads {
		name := filepath.Base(payload)
		want, ok := got[name]
		if !ok {
			return fmt.Errorf("missing checksum for %s", name)
		}
		sum, err := hashFile(payload)
		if err != nil {
			return err
		}
		if want != sum {
			return fmt.Errorf("checksum mismatch for %s", name)
		}
	}
	return nil
}
