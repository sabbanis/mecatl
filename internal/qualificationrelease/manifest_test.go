package qualificationrelease

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestADR_0352_QualificationRelease_Scenario2_MecatedOnlyArtifacts(t *testing.T) {
	t.Parallel()
	dist := t.TempDir()
	tag := "v0.0.39-i2i.1"
	for _, id := range requiredTargets {
		archive := filepath.Join(dist, archiveName(tag, id))
		writeTestArchive(t, archive, []byte("binary-"+id.goos+"-"+id.goarch))
		if err := os.WriteFile(archive+".spdx.json", []byte("{}\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	opts := Options{
		DistDir:      dist,
		Tag:          tag,
		SourceCommit: strings.Repeat("a", 40),
		RequireSBOMs: true,
	}
	if err := Generate(opts); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(dist, manifestFilename))
	if err != nil {
		t.Fatal(err)
	}
	var manifest Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.SchemaVersion != 1 || manifest.Tag != tag || manifest.BuildID != tag {
		t.Fatalf("unexpected manifest identity: %+v", manifest)
	}
	if manifest.ProductMetricsEnabled {
		t.Fatal("qualification manifest enabled product metrics")
	}
	if manifest.RequiredBaseline != requiredBaseline || len(manifest.Targets) != 4 {
		t.Fatalf("unexpected baseline or target set: %+v", manifest)
	}
	checksums, err := os.ReadFile(filepath.Join(dist, checksumsFilename))
	if err != nil {
		t.Fatal(err)
	}
	if lines := strings.Count(string(checksums), "\n"); lines != 9 {
		t.Fatalf("checksum subject count = %d, want 9", lines)
	}
}

func TestGenerateRejectsUnexpectedQualificationArchive(t *testing.T) {
	t.Parallel()
	dist := t.TempDir()
	tag := "v0.0.39-i2i.2"
	for _, id := range requiredTargets {
		writeTestArchive(t, filepath.Join(dist, archiveName(tag, id)), []byte("mecated"))
	}
	writeTestArchive(t, filepath.Join(dist, "mecatui_0.0.39-i2i.2_linux_amd64.tar.gz"), []byte("wrong"))
	err := Generate(Options{
		DistDir:      dist,
		Tag:          tag,
		SourceCommit: strings.Repeat("b", 40),
	})
	if err == nil || !strings.Contains(err.Error(), "expected 4 archives") {
		t.Fatalf("Generate error = %v, want closed archive-set rejection", err)
	}
}

func writeTestArchive(t *testing.T, path string, binary []byte) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(f)
	gz.ModTime = time.Unix(0, 0)
	tw := tar.NewWriter(gz)
	for _, entry := range []struct {
		name string
		mode int64
		body []byte
	}{
		{name: "LICENSE", mode: 0o644, body: []byte("Apache-2.0\n")},
		{name: "mecated", mode: 0o755, body: binary},
	} {
		if err := tw.WriteHeader(&tar.Header{
			Name:    entry.name,
			Mode:    entry.mode,
			Size:    int64(len(entry.body)),
			ModTime: time.Unix(0, 0),
		}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write(entry.body); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
}
