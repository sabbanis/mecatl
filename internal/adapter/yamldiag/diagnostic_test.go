package yamldiag

import (
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/goccy/go-yaml/token"
	yamlv3 "go.yaml.in/yaml/v3"
)

func TestGoccyYAMLMigration_Scenario1_MissingTokenLocationFailsSafe(t *testing.T) {
	t.Parallel()

	const operation = "parse daemon config"
	got := Classify(operation, errors.New("yaml: secret_key: super-secret"))

	if got.Operation != operation {
		t.Fatalf("operation = %q, want %q", got.Operation, operation)
	}
	if got.Category != "parse" {
		t.Fatalf("category = %q, want parse", got.Category)
	}
	if got.HasLocation {
		t.Fatal("HasLocation = true, want false when the parser provides no token")
	}
	if got.Line != 0 || got.Column != 0 {
		t.Fatalf("location = %d:%d, want no invented coordinates", got.Line, got.Column)
	}
}

type locatedError struct {
	token *token.Token
}

func (locatedError) Error() string { return "parser text must not escape" }

func (e locatedError) GetToken() *token.Token { return e.token }

func TestClassify_UsesGoccyTokenLocation(t *testing.T) {
	t.Parallel()

	got := Classify("parse settings", locatedError{token: &token.Token{Position: &token.Position{Line: 7, Column: 11}}})
	if !got.HasLocation || got.Line != 7 || got.Column != 11 {
		t.Fatalf("location = %#v, want 7:11 from goccy token", got)
	}
}

func TestClassify_UsesGoccyParseErrorToken(t *testing.T) {
	t.Parallel()

	var target map[string]any
	err := yaml.Unmarshal([]byte("value: ["), &target)
	if err == nil {
		t.Fatal("malformed YAML unexpectedly parsed")
	}
	if got := Classify("parse settings", err); !got.HasLocation {
		t.Fatalf("diagnostic = %#v, want goccy parse location", got)
	}
}

type matrixFixture struct {
	Cases []matrixCase `yaml:"cases"`
}

type matrixCase struct {
	Name     string            `yaml:"name"`
	Category string            `yaml:"category"`
	Document string            `yaml:"document"`
	Readers  map[string]string `yaml:"readers"`
}

func TestGoccyYAMLMigration_Scenario2_ScalarNullNumericTimestampMatrix(t *testing.T) {
	t.Parallel()

	matrix := loadMatrix(t)
	assertMatrixCoverage(t, matrix, []string{"implicit-bool", "quoted-bool", "null", "empty", "numeric", "timestamp"})
}

func TestGoccyYAMLMigration_Scenario2_TagMergeAnchorAliasMatrix(t *testing.T) {
	t.Parallel()

	matrix := loadMatrix(t)
	assertMatrixCoverage(t, matrix, []string{"tag", "merge", "anchor", "alias", "alias-through-merge"})
}

func loadMatrix(t *testing.T) matrixFixture {
	t.Helper()

	data, err := os.ReadFile("testdata/semantic-matrix.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var matrix matrixFixture
	if err := yamlv3.Unmarshal(data, &matrix); err != nil {
		t.Fatal(err)
	}
	return matrix
}

func assertMatrixCoverage(t *testing.T, matrix matrixFixture, categories []string) {
	t.Helper()

	seen := make(map[string]bool, len(categories))
	for _, fixture := range matrix.Cases {
		if fixture.Name == "" {
			t.Fatal("semantic matrix has an unnamed fixture")
		}
		if fixture.Category == "" {
			t.Fatalf("fixture %q has no category", fixture.Name)
		}
		if strings.TrimSpace(fixture.Document) == "" {
			t.Fatalf("fixture %q has no YAML document", fixture.Name)
		}
		if len(fixture.Readers) == 0 {
			t.Fatalf("fixture %q has no reader outcomes", fixture.Name)
		}
		for reader, outcome := range fixture.Readers {
			if reader == "" || (outcome != "accept" && outcome != "reject") {
				t.Fatalf("fixture %q has invalid reader outcome %q=%q", fixture.Name, reader, outcome)
			}
		}
		seen[fixture.Category] = true
	}
	for _, category := range categories {
		if !seen[category] {
			t.Fatalf("semantic matrix is missing %s coverage", category)
		}
	}
}

func TestGoccyYAMLMigration_Scenario1_NoParserStringOrIndentationHeuristic(t *testing.T) {
	t.Parallel()

	data, err := os.ReadFile("diagnostic.go")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), ".Error()") || strings.Contains(strings.ToLower(string(data)), "indent") {
		t.Fatal("safe diagnostic boundary must not inspect parser strings or indentation")
	}
}
