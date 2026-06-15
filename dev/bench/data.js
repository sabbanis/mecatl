window.BENCHMARK_DATA = {
  "lastUpdate": 1781501535479,
  "repoUrl": "https://github.com/stacklok/mecatl",
  "entries": {
    "mecatl go microbenchmarks": [
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "769966850abfbb437ec70eda7ce4c911ec12e289",
          "message": "docs(skills): cross-reference PGO in the perf-optimization skill\n\nAdd a brief \"Complementary: PGO\" section + a PGO trigger keyword to the description,\nso the skill covers the profile-guided-optimization lever (task pgo:collect, the\ncmd/mecated/default.pgo auto-pickup, the don't-commit-an-offline-profile rule) and a\n\"how do I PGO mecatl\" question routes here. Detail is not duplicated — it points to\nperf-tracking.md Phase 4 for the full rationale + production refresh process.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T07:46:19+03:00",
          "tree_id": "63d17d732ffd7b3db70262ef63d3d75c94ea0328",
          "url": "https://github.com/stacklok/mecatl/commit/769966850abfbb437ec70eda7ce4c911ec12e289"
        },
        "date": 1781500258733,
        "tool": "go",
        "benches": [
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2028,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "545364 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2028,
            "unit": "ns/op",
            "extra": "545364 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "545364 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "545364 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2055,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "562140 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2055,
            "unit": "ns/op",
            "extra": "562140 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "562140 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "562140 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2020,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "618883 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2020,
            "unit": "ns/op",
            "extra": "618883 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "618883 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "618883 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2013,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "591177 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2013,
            "unit": "ns/op",
            "extra": "591177 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "591177 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "591177 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2074,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "531058 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2074,
            "unit": "ns/op",
            "extra": "531058 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "531058 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "531058 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2053,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "582475 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2053,
            "unit": "ns/op",
            "extra": "582475 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "582475 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "582475 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2327,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "581518 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2327,
            "unit": "ns/op",
            "extra": "581518 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "581518 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "581518 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2103,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "578176 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2103,
            "unit": "ns/op",
            "extra": "578176 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "578176 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "578176 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2144,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "586240 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2144,
            "unit": "ns/op",
            "extra": "586240 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "586240 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "586240 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2058,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "598596 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2058,
            "unit": "ns/op",
            "extra": "598596 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "598596 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "598596 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9618,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "117754 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9618,
            "unit": "ns/op",
            "extra": "117754 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "117754 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "117754 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9728,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "115758 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9728,
            "unit": "ns/op",
            "extra": "115758 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "115758 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "115758 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9138,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "139689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9138,
            "unit": "ns/op",
            "extra": "139689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "139689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "139689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8932,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "119426 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8932,
            "unit": "ns/op",
            "extra": "119426 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "119426 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "119426 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8491,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "143738 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8491,
            "unit": "ns/op",
            "extra": "143738 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "143738 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "143738 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8836,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "135896 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8836,
            "unit": "ns/op",
            "extra": "135896 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "135896 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "135896 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9219,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "123217 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9219,
            "unit": "ns/op",
            "extra": "123217 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "123217 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "123217 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8995,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "136671 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8995,
            "unit": "ns/op",
            "extra": "136671 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "136671 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "136671 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9211,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "137566 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9211,
            "unit": "ns/op",
            "extra": "137566 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "137566 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "137566 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9496,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "131854 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9496,
            "unit": "ns/op",
            "extra": "131854 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "131854 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "131854 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 823.2,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1448890 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 823.2,
            "unit": "ns/op",
            "extra": "1448890 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1448890 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1448890 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 811.7,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1473964 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 811.7,
            "unit": "ns/op",
            "extra": "1473964 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1473964 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1473964 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 871.8,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1462483 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 871.8,
            "unit": "ns/op",
            "extra": "1462483 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1462483 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1462483 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 854.3,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1333875 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 854.3,
            "unit": "ns/op",
            "extra": "1333875 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1333875 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1333875 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 825.7,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1447473 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 825.7,
            "unit": "ns/op",
            "extra": "1447473 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1447473 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1447473 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 813,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1469218 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 813,
            "unit": "ns/op",
            "extra": "1469218 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1469218 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1469218 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 819.2,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1460712 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 819.2,
            "unit": "ns/op",
            "extra": "1460712 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1460712 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1460712 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 821.3,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1460871 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 821.3,
            "unit": "ns/op",
            "extra": "1460871 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1460871 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1460871 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 821.5,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1459880 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 821.5,
            "unit": "ns/op",
            "extra": "1459880 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1459880 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1459880 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 815.4,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1465958 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 815.4,
            "unit": "ns/op",
            "extra": "1465958 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1465958 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1465958 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1721,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "623394 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1721,
            "unit": "ns/op",
            "extra": "623394 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "623394 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "623394 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1705,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "657657 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1705,
            "unit": "ns/op",
            "extra": "657657 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "657657 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "657657 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1715,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "646846 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1715,
            "unit": "ns/op",
            "extra": "646846 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "646846 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "646846 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1699,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "642919 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1699,
            "unit": "ns/op",
            "extra": "642919 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "642919 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "642919 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1688,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "648778 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1688,
            "unit": "ns/op",
            "extra": "648778 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "648778 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "648778 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1681,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "688831 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1681,
            "unit": "ns/op",
            "extra": "688831 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "688831 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "688831 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1762,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "700677 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1762,
            "unit": "ns/op",
            "extra": "700677 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "700677 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "700677 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1681,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "718758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1681,
            "unit": "ns/op",
            "extra": "718758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "718758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "718758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1689,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "707523 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1689,
            "unit": "ns/op",
            "extra": "707523 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "707523 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "707523 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1667,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "689475 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1667,
            "unit": "ns/op",
            "extra": "689475 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "689475 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "689475 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1843,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "633988 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1843,
            "unit": "ns/op",
            "extra": "633988 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "633988 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "633988 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1803,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "609871 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1803,
            "unit": "ns/op",
            "extra": "609871 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "609871 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "609871 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1805,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "633158 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1805,
            "unit": "ns/op",
            "extra": "633158 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "633158 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "633158 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1803,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "616152 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1803,
            "unit": "ns/op",
            "extra": "616152 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "616152 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "616152 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1817,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "608422 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1817,
            "unit": "ns/op",
            "extra": "608422 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "608422 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "608422 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1803,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "629527 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1803,
            "unit": "ns/op",
            "extra": "629527 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "629527 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "629527 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1806,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "652441 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1806,
            "unit": "ns/op",
            "extra": "652441 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "652441 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "652441 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1804,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "603038 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1804,
            "unit": "ns/op",
            "extra": "603038 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "603038 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "603038 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1802,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "656394 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1802,
            "unit": "ns/op",
            "extra": "656394 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "656394 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "656394 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1800,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "640903 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1800,
            "unit": "ns/op",
            "extra": "640903 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "640903 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "640903 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2745,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "415034 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2745,
            "unit": "ns/op",
            "extra": "415034 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "415034 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "415034 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2746,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "408042 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2746,
            "unit": "ns/op",
            "extra": "408042 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "408042 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "408042 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2739,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "422168 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2739,
            "unit": "ns/op",
            "extra": "422168 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "422168 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "422168 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2722,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "431061 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2722,
            "unit": "ns/op",
            "extra": "431061 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "431061 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "431061 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2723,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "425742 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2723,
            "unit": "ns/op",
            "extra": "425742 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "425742 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "425742 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2732,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "433293 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2732,
            "unit": "ns/op",
            "extra": "433293 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "433293 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "433293 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2744,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "405626 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2744,
            "unit": "ns/op",
            "extra": "405626 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "405626 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "405626 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2732,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "436503 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2732,
            "unit": "ns/op",
            "extra": "436503 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "436503 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "436503 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2762,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "418953 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2762,
            "unit": "ns/op",
            "extra": "418953 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "418953 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "418953 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2736,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "424261 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2736,
            "unit": "ns/op",
            "extra": "424261 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "424261 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "424261 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1334,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "900117 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1334,
            "unit": "ns/op",
            "extra": "900117 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "900117 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "900117 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1336,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "871437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1336,
            "unit": "ns/op",
            "extra": "871437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "871437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "871437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1331,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "900806 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1331,
            "unit": "ns/op",
            "extra": "900806 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "900806 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "900806 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1334,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "898972 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1334,
            "unit": "ns/op",
            "extra": "898972 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "898972 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "898972 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1330,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "904828 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1330,
            "unit": "ns/op",
            "extra": "904828 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "904828 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "904828 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1330,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "854671 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1330,
            "unit": "ns/op",
            "extra": "854671 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "854671 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "854671 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1335,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "852982 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1335,
            "unit": "ns/op",
            "extra": "852982 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "852982 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "852982 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1370,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "783298 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1370,
            "unit": "ns/op",
            "extra": "783298 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "783298 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "783298 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1332,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "907315 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1332,
            "unit": "ns/op",
            "extra": "907315 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "907315 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "907315 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1332,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "876142 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1332,
            "unit": "ns/op",
            "extra": "876142 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "876142 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "876142 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2079,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "578545 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2079,
            "unit": "ns/op",
            "extra": "578545 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "578545 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "578545 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2078,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "557805 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2078,
            "unit": "ns/op",
            "extra": "557805 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "557805 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "557805 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2071,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "547392 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2071,
            "unit": "ns/op",
            "extra": "547392 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "547392 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "547392 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2074,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "576436 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2074,
            "unit": "ns/op",
            "extra": "576436 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "576436 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "576436 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2086,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "563100 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2086,
            "unit": "ns/op",
            "extra": "563100 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "563100 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "563100 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2105,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "505512 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2105,
            "unit": "ns/op",
            "extra": "505512 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "505512 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "505512 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2087,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "572406 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2087,
            "unit": "ns/op",
            "extra": "572406 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "572406 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "572406 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2087,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "521773 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2087,
            "unit": "ns/op",
            "extra": "521773 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "521773 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "521773 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2083,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "551169 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2083,
            "unit": "ns/op",
            "extra": "551169 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "551169 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "551169 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2092,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "584146 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2092,
            "unit": "ns/op",
            "extra": "584146 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "584146 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "584146 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4034,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "280753 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4034,
            "unit": "ns/op",
            "extra": "280753 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "280753 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "280753 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4061,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "276013 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4061,
            "unit": "ns/op",
            "extra": "276013 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "276013 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "276013 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4046,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "301870 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4046,
            "unit": "ns/op",
            "extra": "301870 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "301870 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "301870 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4057,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "295108 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4057,
            "unit": "ns/op",
            "extra": "295108 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "295108 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "295108 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4070,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "284382 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4070,
            "unit": "ns/op",
            "extra": "284382 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "284382 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "284382 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4076,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "293691 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4076,
            "unit": "ns/op",
            "extra": "293691 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "293691 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "293691 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4038,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "286240 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4038,
            "unit": "ns/op",
            "extra": "286240 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "286240 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "286240 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4051,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "282530 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4051,
            "unit": "ns/op",
            "extra": "282530 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "282530 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "282530 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4036,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "298286 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4036,
            "unit": "ns/op",
            "extra": "298286 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "298286 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "298286 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4072,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "283569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4072,
            "unit": "ns/op",
            "extra": "283569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "283569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "283569 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5461,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "215598 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5461,
            "unit": "ns/op",
            "extra": "215598 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "215598 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "215598 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5350,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "227689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5350,
            "unit": "ns/op",
            "extra": "227689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "227689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "227689 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6628,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "161227 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6628,
            "unit": "ns/op",
            "extra": "161227 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "161227 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "161227 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5525,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "224690 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5525,
            "unit": "ns/op",
            "extra": "224690 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "224690 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "224690 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5430,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "210712 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5430,
            "unit": "ns/op",
            "extra": "210712 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "210712 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "210712 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5492,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "224995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5492,
            "unit": "ns/op",
            "extra": "224995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "224995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "224995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5563,
            "unit": "ns/op\t   12464 B/op\t      58 allocs/op",
            "extra": "222520 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5563,
            "unit": "ns/op",
            "extra": "222520 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "222520 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "222520 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5736,
            "unit": "ns/op\t   12464 B/op\t      58 allocs/op",
            "extra": "225417 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5736,
            "unit": "ns/op",
            "extra": "225417 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "225417 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "225417 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5528,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "221967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5528,
            "unit": "ns/op",
            "extra": "221967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "221967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "221967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5375,
            "unit": "ns/op\t   12464 B/op\t      58 allocs/op",
            "extra": "225561 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5375,
            "unit": "ns/op",
            "extra": "225561 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "225561 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "225561 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24712,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48292 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24712,
            "unit": "ns/op",
            "extra": "48292 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48292 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48292 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26357,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26357,
            "unit": "ns/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24791,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48198 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24791,
            "unit": "ns/op",
            "extra": "48198 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48198 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48198 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24870,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "47727 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24870,
            "unit": "ns/op",
            "extra": "47727 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "47727 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "47727 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24689,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48438 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24689,
            "unit": "ns/op",
            "extra": "48438 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48438 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48438 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24760,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48668 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24760,
            "unit": "ns/op",
            "extra": "48668 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48668 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48668 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24679,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48153 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24679,
            "unit": "ns/op",
            "extra": "48153 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48153 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48153 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24765,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48522 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24765,
            "unit": "ns/op",
            "extra": "48522 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48522 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48522 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24571,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "49003 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24571,
            "unit": "ns/op",
            "extra": "49003 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "49003 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "49003 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25206,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "45075 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25206,
            "unit": "ns/op",
            "extra": "45075 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "45075 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "45075 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34019,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35670 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34019,
            "unit": "ns/op",
            "extra": "35670 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35670 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35670 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33138,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "36260 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33138,
            "unit": "ns/op",
            "extra": "36260 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "36260 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "36260 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33546,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35740 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33546,
            "unit": "ns/op",
            "extra": "35740 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35740 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35740 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33578,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35600 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33578,
            "unit": "ns/op",
            "extra": "35600 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35600 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35600 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33367,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35631 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33367,
            "unit": "ns/op",
            "extra": "35631 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35631 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35631 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33598,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35694 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33598,
            "unit": "ns/op",
            "extra": "35694 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35694 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35694 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33446,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35782 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33446,
            "unit": "ns/op",
            "extra": "35782 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35782 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35782 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33951,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35415 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33951,
            "unit": "ns/op",
            "extra": "35415 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35415 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35415 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34293,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35908 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34293,
            "unit": "ns/op",
            "extra": "35908 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35908 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35908 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33878,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34933 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33878,
            "unit": "ns/op",
            "extra": "34933 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34933 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34933 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29836,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29836,
            "unit": "ns/op",
            "extra": "39680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29696,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "40513 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29696,
            "unit": "ns/op",
            "extra": "40513 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "40513 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "40513 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 30068,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39349 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 30068,
            "unit": "ns/op",
            "extra": "39349 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39349 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39349 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29585,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "40575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29585,
            "unit": "ns/op",
            "extra": "40575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "40575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "40575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 30151,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39786 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 30151,
            "unit": "ns/op",
            "extra": "39786 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39786 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39786 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29915,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39523 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29915,
            "unit": "ns/op",
            "extra": "39523 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39523 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39523 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29844,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "40176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29844,
            "unit": "ns/op",
            "extra": "40176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "40176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "40176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29818,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39292 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29818,
            "unit": "ns/op",
            "extra": "39292 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39292 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39292 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29794,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "41456 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29794,
            "unit": "ns/op",
            "extra": "41456 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "41456 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "41456 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 29639,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "41199 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 29639,
            "unit": "ns/op",
            "extra": "41199 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "41199 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "41199 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43431,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "27357 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43431,
            "unit": "ns/op",
            "extra": "27357 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "27357 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "27357 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43982,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26713 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43982,
            "unit": "ns/op",
            "extra": "26713 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26713 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26713 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43084,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "28062 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43084,
            "unit": "ns/op",
            "extra": "28062 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "28062 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "28062 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 42688,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "28087 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 42688,
            "unit": "ns/op",
            "extra": "28087 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "28087 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "28087 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 48204,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "27844 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 48204,
            "unit": "ns/op",
            "extra": "27844 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "27844 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "27844 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43254,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "27590 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43254,
            "unit": "ns/op",
            "extra": "27590 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "27590 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "27590 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43359,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "28356 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43359,
            "unit": "ns/op",
            "extra": "28356 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "28356 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "28356 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 42439,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "27915 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 42439,
            "unit": "ns/op",
            "extra": "27915 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "27915 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "27915 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43152,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "28140 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43152,
            "unit": "ns/op",
            "extra": "28140 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "28140 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "28140 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43112,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "28122 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43112,
            "unit": "ns/op",
            "extra": "28122 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "28122 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "28122 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26780,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "44067 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26780,
            "unit": "ns/op",
            "extra": "44067 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "44067 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44067 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 27053,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "43633 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27053,
            "unit": "ns/op",
            "extra": "43633 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "43633 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "43633 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26429,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "45409 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26429,
            "unit": "ns/op",
            "extra": "45409 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "45409 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "45409 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26528,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "45454 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26528,
            "unit": "ns/op",
            "extra": "45454 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "45454 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "45454 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 27110,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "43687 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27110,
            "unit": "ns/op",
            "extra": "43687 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "43687 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "43687 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26259,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "46176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26259,
            "unit": "ns/op",
            "extra": "46176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "46176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "46176 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26754,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "45681 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26754,
            "unit": "ns/op",
            "extra": "45681 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "45681 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "45681 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 27235,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "42096 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27235,
            "unit": "ns/op",
            "extra": "42096 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "42096 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "42096 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26944,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "44276 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26944,
            "unit": "ns/op",
            "extra": "44276 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "44276 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44276 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26784,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "45570 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26784,
            "unit": "ns/op",
            "extra": "45570 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "45570 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "45570 times\n2 procs"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "d1f6d53bfd753ddd06b95aa556f960548ad47992",
          "message": "ci(perf): fetch the allocs baseline via authenticated gh api (private-repo safe)\n\nThe first perf-main run failed: github-action-benchmark's auto-push fetches the\ngh-pages branch before it can create it, and the branch didn't exist\n(`fatal: couldn't find remote ref gh-pages`). Bootstrapped gh-pages as an empty\norphan branch (one-time) so the action can fetch+push it.\n\nSeparately, the allocs-gate baseline was fetched via `curl raw.githubusercontent.com`,\nwhich is UNAUTHENTICATED and 404s on a private repo (this repo is private) — silently\nsinking the micro allocs gate into its skip path on every PR. Switch both fetch sites\n(perf-pr + perf-main) to authenticated `gh api ...contents...?ref=gh-pages` with the\nGITHUB_TOKEN; a failed fetch still leaves NO file so allocsgate takes its absent→skip\npath (not present-but-empty→fail-loud). The trend store + the github-action-benchmark\nscenario gates were already private-safe (authenticated git via GITHUB_TOKEN); only\nthe raw-URL micro-baseline fetch was broken. Documented the private-repo posture +\nthe gh-pages bootstrap requirement in perf-tracking.md.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T08:09:38+03:00",
          "tree_id": "9bee2bf24954b44412d9a1680f7af13b9fd71adb",
          "url": "https://github.com/stacklok/mecatl/commit/d1f6d53bfd753ddd06b95aa556f960548ad47992"
        },
        "date": 1781500589326,
        "tool": "go",
        "benches": [
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2193,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "460366 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2193,
            "unit": "ns/op",
            "extra": "460366 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "460366 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "460366 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2402,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "424796 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2402,
            "unit": "ns/op",
            "extra": "424796 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "424796 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "424796 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2230,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "528802 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2230,
            "unit": "ns/op",
            "extra": "528802 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "528802 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "528802 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2207,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "548466 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2207,
            "unit": "ns/op",
            "extra": "548466 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "548466 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "548466 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2743,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "525646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2743,
            "unit": "ns/op",
            "extra": "525646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "525646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "525646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2281,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "493609 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2281,
            "unit": "ns/op",
            "extra": "493609 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "493609 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "493609 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2379,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "519535 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2379,
            "unit": "ns/op",
            "extra": "519535 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "519535 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "519535 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2252,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "583851 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2252,
            "unit": "ns/op",
            "extra": "583851 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "583851 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "583851 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2216,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "544108 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2216,
            "unit": "ns/op",
            "extra": "544108 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "544108 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "544108 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2188,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "517243 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2188,
            "unit": "ns/op",
            "extra": "517243 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "517243 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "517243 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9064,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "127191 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9064,
            "unit": "ns/op",
            "extra": "127191 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "127191 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "127191 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9107,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "134726 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9107,
            "unit": "ns/op",
            "extra": "134726 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "134726 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "134726 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9216,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "133300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9216,
            "unit": "ns/op",
            "extra": "133300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "133300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "133300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9320,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "137281 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9320,
            "unit": "ns/op",
            "extra": "137281 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "137281 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "137281 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9586,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "117985 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9586,
            "unit": "ns/op",
            "extra": "117985 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "117985 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "117985 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9152,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "128995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9152,
            "unit": "ns/op",
            "extra": "128995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "128995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "128995 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 10018,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "113392 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 10018,
            "unit": "ns/op",
            "extra": "113392 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "113392 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "113392 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9129,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "130567 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9129,
            "unit": "ns/op",
            "extra": "130567 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "130567 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "130567 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9297,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "124734 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9297,
            "unit": "ns/op",
            "extra": "124734 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "124734 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "124734 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9135,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "134599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9135,
            "unit": "ns/op",
            "extra": "134599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "134599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "134599 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 945.6,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1266594 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 945.6,
            "unit": "ns/op",
            "extra": "1266594 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1266594 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1266594 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 1071,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1071,
            "unit": "ns/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 940.1,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1274664 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 940.1,
            "unit": "ns/op",
            "extra": "1274664 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1274664 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1274664 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 944.4,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1268413 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 944.4,
            "unit": "ns/op",
            "extra": "1268413 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1268413 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1268413 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 937,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1280191 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 937,
            "unit": "ns/op",
            "extra": "1280191 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1280191 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1280191 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 938.8,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1276444 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 938.8,
            "unit": "ns/op",
            "extra": "1276444 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1276444 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1276444 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 943.9,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1269171 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 943.9,
            "unit": "ns/op",
            "extra": "1269171 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1269171 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1269171 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 941.6,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1270779 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 941.6,
            "unit": "ns/op",
            "extra": "1270779 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1270779 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1270779 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 942,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1273568 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 942,
            "unit": "ns/op",
            "extra": "1273568 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1273568 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1273568 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 1001,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1001,
            "unit": "ns/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1000000 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1794,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "624988 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1794,
            "unit": "ns/op",
            "extra": "624988 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "624988 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "624988 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1850,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "617068 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1850,
            "unit": "ns/op",
            "extra": "617068 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "617068 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "617068 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1800,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "674920 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1800,
            "unit": "ns/op",
            "extra": "674920 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "674920 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "674920 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1821,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "637308 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1821,
            "unit": "ns/op",
            "extra": "637308 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "637308 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "637308 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1806,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "668228 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1806,
            "unit": "ns/op",
            "extra": "668228 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "668228 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "668228 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1803,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "667700 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1803,
            "unit": "ns/op",
            "extra": "667700 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "667700 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "667700 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1805,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "661161 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1805,
            "unit": "ns/op",
            "extra": "661161 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "661161 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "661161 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1800,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "668066 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1800,
            "unit": "ns/op",
            "extra": "668066 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "668066 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "668066 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1973,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "647806 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1973,
            "unit": "ns/op",
            "extra": "647806 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "647806 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "647806 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1832,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "642853 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1832,
            "unit": "ns/op",
            "extra": "642853 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "642853 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "642853 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1848,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "604399 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1848,
            "unit": "ns/op",
            "extra": "604399 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "604399 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "604399 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1861,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "593487 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1861,
            "unit": "ns/op",
            "extra": "593487 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "593487 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "593487 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1841,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "642369 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1841,
            "unit": "ns/op",
            "extra": "642369 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "642369 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "642369 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1844,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "600135 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1844,
            "unit": "ns/op",
            "extra": "600135 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "600135 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "600135 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1852,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "610274 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1852,
            "unit": "ns/op",
            "extra": "610274 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "610274 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "610274 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1839,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "618290 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1839,
            "unit": "ns/op",
            "extra": "618290 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "618290 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "618290 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1903,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "621297 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1903,
            "unit": "ns/op",
            "extra": "621297 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "621297 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "621297 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1851,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "634606 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1851,
            "unit": "ns/op",
            "extra": "634606 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "634606 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "634606 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1897,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "620875 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1897,
            "unit": "ns/op",
            "extra": "620875 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "620875 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "620875 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1851,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "632917 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1851,
            "unit": "ns/op",
            "extra": "632917 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "632917 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "632917 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2869,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "394948 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2869,
            "unit": "ns/op",
            "extra": "394948 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "394948 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "394948 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2862,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "422676 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2862,
            "unit": "ns/op",
            "extra": "422676 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "422676 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "422676 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2866,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "413018 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2866,
            "unit": "ns/op",
            "extra": "413018 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "413018 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "413018 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2862,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "403212 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2862,
            "unit": "ns/op",
            "extra": "403212 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "403212 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "403212 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2869,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "422571 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2869,
            "unit": "ns/op",
            "extra": "422571 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "422571 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "422571 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2864,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "408710 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2864,
            "unit": "ns/op",
            "extra": "408710 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "408710 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "408710 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2858,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "416079 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2858,
            "unit": "ns/op",
            "extra": "416079 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "416079 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "416079 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2866,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "399975 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2866,
            "unit": "ns/op",
            "extra": "399975 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "399975 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "399975 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2858,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "402422 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2858,
            "unit": "ns/op",
            "extra": "402422 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "402422 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "402422 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2863,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "404142 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2863,
            "unit": "ns/op",
            "extra": "404142 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "404142 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "404142 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1455,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "717454 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1455,
            "unit": "ns/op",
            "extra": "717454 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "717454 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "717454 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1444,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "802686 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1444,
            "unit": "ns/op",
            "extra": "802686 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "802686 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "802686 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1455,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "782128 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1455,
            "unit": "ns/op",
            "extra": "782128 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "782128 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "782128 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1452,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "825468 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1452,
            "unit": "ns/op",
            "extra": "825468 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "825468 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "825468 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1460,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "697735 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1460,
            "unit": "ns/op",
            "extra": "697735 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "697735 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "697735 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1477,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "823988 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1477,
            "unit": "ns/op",
            "extra": "823988 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "823988 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "823988 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1456,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "849439 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1456,
            "unit": "ns/op",
            "extra": "849439 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "849439 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "849439 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1471,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "813610 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1471,
            "unit": "ns/op",
            "extra": "813610 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "813610 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "813610 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1452,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "815060 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1452,
            "unit": "ns/op",
            "extra": "815060 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "815060 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "815060 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1451,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "840645 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1451,
            "unit": "ns/op",
            "extra": "840645 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "840645 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "840645 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2188,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "535587 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2188,
            "unit": "ns/op",
            "extra": "535587 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "535587 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "535587 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2207,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "548887 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2207,
            "unit": "ns/op",
            "extra": "548887 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "548887 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "548887 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2200,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "525640 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2200,
            "unit": "ns/op",
            "extra": "525640 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "525640 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "525640 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2207,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "515000 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2207,
            "unit": "ns/op",
            "extra": "515000 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "515000 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "515000 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2200,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "540500 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2200,
            "unit": "ns/op",
            "extra": "540500 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "540500 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "540500 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2207,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "496740 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2207,
            "unit": "ns/op",
            "extra": "496740 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "496740 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "496740 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2199,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "523275 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2199,
            "unit": "ns/op",
            "extra": "523275 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "523275 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "523275 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2278,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "550569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2278,
            "unit": "ns/op",
            "extra": "550569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "550569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "550569 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2202,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "543964 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2202,
            "unit": "ns/op",
            "extra": "543964 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "543964 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "543964 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2202,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "509709 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2202,
            "unit": "ns/op",
            "extra": "509709 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "509709 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "509709 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4259,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "273214 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4259,
            "unit": "ns/op",
            "extra": "273214 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "273214 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "273214 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4252,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "282252 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4252,
            "unit": "ns/op",
            "extra": "282252 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "282252 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "282252 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4248,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "279074 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4248,
            "unit": "ns/op",
            "extra": "279074 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "279074 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "279074 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4268,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "254724 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4268,
            "unit": "ns/op",
            "extra": "254724 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "254724 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "254724 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4248,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "273602 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4248,
            "unit": "ns/op",
            "extra": "273602 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "273602 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "273602 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4244,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "285261 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4244,
            "unit": "ns/op",
            "extra": "285261 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "285261 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "285261 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4232,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "280359 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4232,
            "unit": "ns/op",
            "extra": "280359 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "280359 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "280359 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4240,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "283780 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4240,
            "unit": "ns/op",
            "extra": "283780 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "283780 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "283780 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4250,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "276424 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4250,
            "unit": "ns/op",
            "extra": "276424 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "276424 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "276424 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4259,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "268348 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4259,
            "unit": "ns/op",
            "extra": "268348 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "268348 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "268348 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5918,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "204950 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5918,
            "unit": "ns/op",
            "extra": "204950 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "204950 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "204950 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5723,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "213727 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5723,
            "unit": "ns/op",
            "extra": "213727 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "213727 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "213727 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5774,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "217318 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5774,
            "unit": "ns/op",
            "extra": "217318 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "217318 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "217318 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5802,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "210740 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5802,
            "unit": "ns/op",
            "extra": "210740 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "210740 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "210740 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5786,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "199303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5786,
            "unit": "ns/op",
            "extra": "199303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "199303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "199303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5647,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "219751 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5647,
            "unit": "ns/op",
            "extra": "219751 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "219751 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "219751 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5763,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "204687 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5763,
            "unit": "ns/op",
            "extra": "204687 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "204687 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "204687 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5740,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "194605 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5740,
            "unit": "ns/op",
            "extra": "194605 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "194605 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "194605 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6932,
            "unit": "ns/op\t   12464 B/op\t      58 allocs/op",
            "extra": "188082 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6932,
            "unit": "ns/op",
            "extra": "188082 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "188082 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "188082 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5712,
            "unit": "ns/op\t   12464 B/op\t      58 allocs/op",
            "extra": "215835 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5712,
            "unit": "ns/op",
            "extra": "215835 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "215835 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "215835 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26057,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "45708 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26057,
            "unit": "ns/op",
            "extra": "45708 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "45708 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "45708 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25776,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "46041 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25776,
            "unit": "ns/op",
            "extra": "46041 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "46041 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46041 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25862,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "46497 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25862,
            "unit": "ns/op",
            "extra": "46497 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "46497 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46497 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25758,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "46308 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25758,
            "unit": "ns/op",
            "extra": "46308 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "46308 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46308 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25747,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "46542 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25747,
            "unit": "ns/op",
            "extra": "46542 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "46542 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46542 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26327,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "46286 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26327,
            "unit": "ns/op",
            "extra": "46286 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "46286 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46286 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25819,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "46789 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25819,
            "unit": "ns/op",
            "extra": "46789 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "46789 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46789 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25840,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "46678 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25840,
            "unit": "ns/op",
            "extra": "46678 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "46678 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46678 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25811,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "46363 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25811,
            "unit": "ns/op",
            "extra": "46363 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "46363 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46363 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 25821,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "46915 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 25821,
            "unit": "ns/op",
            "extra": "46915 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "46915 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "46915 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35004,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34690 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35004,
            "unit": "ns/op",
            "extra": "34690 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34690 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34690 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34962,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "33765 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34962,
            "unit": "ns/op",
            "extra": "33765 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "33765 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33765 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34724,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "34278 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34724,
            "unit": "ns/op",
            "extra": "34278 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "34278 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34278 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34669,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "33962 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34669,
            "unit": "ns/op",
            "extra": "33962 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "33962 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33962 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34846,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34846,
            "unit": "ns/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 36091,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "33943 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36091,
            "unit": "ns/op",
            "extra": "33943 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "33943 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33943 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34745,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34745,
            "unit": "ns/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34774 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34582,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34665 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34582,
            "unit": "ns/op",
            "extra": "34665 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34665 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34665 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35360,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "33718 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35360,
            "unit": "ns/op",
            "extra": "33718 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "33718 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33718 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34796,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34796,
            "unit": "ns/op",
            "extra": "34114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34114 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 33051,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36600 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33051,
            "unit": "ns/op",
            "extra": "36600 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36600 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36600 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 33788,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36327 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33788,
            "unit": "ns/op",
            "extra": "36327 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36327 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36327 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 33583,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36860 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33583,
            "unit": "ns/op",
            "extra": "36860 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36860 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36860 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32836,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "38092 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32836,
            "unit": "ns/op",
            "extra": "38092 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "38092 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "38092 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 34750,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "35564 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34750,
            "unit": "ns/op",
            "extra": "35564 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "35564 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "35564 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 33971,
            "unit": "ns/op\t   32674 B/op\t     158 allocs/op",
            "extra": "36512 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33971,
            "unit": "ns/op",
            "extra": "36512 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32674,
            "unit": "B/op",
            "extra": "36512 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36512 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 34413,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "33421 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34413,
            "unit": "ns/op",
            "extra": "33421 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "33421 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "33421 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32505,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36922 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32505,
            "unit": "ns/op",
            "extra": "36922 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36922 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36922 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 33318,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "34954 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33318,
            "unit": "ns/op",
            "extra": "34954 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "34954 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "34954 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32540,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36781 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32540,
            "unit": "ns/op",
            "extra": "36781 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36781 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36781 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 48230,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "24524 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 48230,
            "unit": "ns/op",
            "extra": "24524 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "24524 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "24524 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 47012,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 47012,
            "unit": "ns/op",
            "extra": "26170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 48151,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "23977 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 48151,
            "unit": "ns/op",
            "extra": "23977 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "23977 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "23977 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 46464,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25623 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 46464,
            "unit": "ns/op",
            "extra": "25623 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25623 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25623 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 47723,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "24679 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 47723,
            "unit": "ns/op",
            "extra": "24679 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "24679 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "24679 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 49384,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "23446 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 49384,
            "unit": "ns/op",
            "extra": "23446 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "23446 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "23446 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 48260,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25354 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 48260,
            "unit": "ns/op",
            "extra": "25354 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25354 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25354 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 47501,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25234 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 47501,
            "unit": "ns/op",
            "extra": "25234 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25234 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25234 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 47893,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25438 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 47893,
            "unit": "ns/op",
            "extra": "25438 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25438 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25438 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 47172,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25146 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 47172,
            "unit": "ns/op",
            "extra": "25146 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25146 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25146 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31296,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "36319 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31296,
            "unit": "ns/op",
            "extra": "36319 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "36319 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "36319 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 30435,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37994 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 30435,
            "unit": "ns/op",
            "extra": "37994 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37994 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37994 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 30942,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "41018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 30942,
            "unit": "ns/op",
            "extra": "41018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "41018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "41018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 30904,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "38415 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 30904,
            "unit": "ns/op",
            "extra": "38415 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "38415 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "38415 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32177,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37023 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32177,
            "unit": "ns/op",
            "extra": "37023 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37023 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37023 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32150,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37144 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32150,
            "unit": "ns/op",
            "extra": "37144 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37144 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37144 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32638,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "35868 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32638,
            "unit": "ns/op",
            "extra": "35868 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "35868 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "35868 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32389,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "38280 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32389,
            "unit": "ns/op",
            "extra": "38280 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "38280 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "38280 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32950,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "34743 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32950,
            "unit": "ns/op",
            "extra": "34743 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "34743 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "34743 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31088,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "38625 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31088,
            "unit": "ns/op",
            "extra": "38625 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "38625 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "38625 times\n2 procs"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "111325e729b34214493d9d67d1a8065105cbbbec",
          "message": "fix(openai): human-readable message for response.incomplete content_filter\n\nA content_filter response.incomplete surfaced as the cryptic terminal\n`agent: stream: response incomplete: content_filter`, reading like a\nmecatl bug when it is an UPSTREAM moderation block (e.g. OpenRouter\nrouting gpt-5.5 to an Azure OpenAI upstream whose filter false-positives\non benign security/credentials wording).\n\nAdd incompleteMessage(), keyed on incomplete_details.reason: content_filter\nand max_output_tokens render plain-language messages (content_filter names\nit as upstream moderation, not a mecatl error, and hints to retype to\ncontinue — the session is failed-recoverable via #51); unknown/future\nreasons fall back byte-identically to `response incomplete: <reason>`.\n\nPresentation only — retry classification is untouched (content_filter\nstays a non-retryable bare error; replaying the prompt just trips it\nagain). Adapter-local, no port/LLMRequest change.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T08:11:43+03:00",
          "tree_id": "426daa2671d637cb0535013f3c38da673e4131ab",
          "url": "https://github.com/stacklok/mecatl/commit/111325e729b34214493d9d67d1a8065105cbbbec"
        },
        "date": 1781500919280,
        "tool": "go",
        "benches": [
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2029,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "529639 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2029,
            "unit": "ns/op",
            "extra": "529639 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "529639 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "529639 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2334,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "536871 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2334,
            "unit": "ns/op",
            "extra": "536871 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "536871 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "536871 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2137,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "557166 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2137,
            "unit": "ns/op",
            "extra": "557166 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "557166 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "557166 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2183,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "602829 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2183,
            "unit": "ns/op",
            "extra": "602829 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "602829 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "602829 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2324,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "611844 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2324,
            "unit": "ns/op",
            "extra": "611844 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "611844 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "611844 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2210,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "537618 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2210,
            "unit": "ns/op",
            "extra": "537618 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "537618 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "537618 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2075,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "602694 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2075,
            "unit": "ns/op",
            "extra": "602694 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "602694 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "602694 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2110,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "600068 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2110,
            "unit": "ns/op",
            "extra": "600068 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "600068 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "600068 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2150,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "480589 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2150,
            "unit": "ns/op",
            "extra": "480589 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "480589 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "480589 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2114,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "520152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2114,
            "unit": "ns/op",
            "extra": "520152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "520152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "520152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9110,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "115194 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9110,
            "unit": "ns/op",
            "extra": "115194 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "115194 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "115194 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8702,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "133326 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8702,
            "unit": "ns/op",
            "extra": "133326 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "133326 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "133326 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8743,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "134464 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8743,
            "unit": "ns/op",
            "extra": "134464 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "134464 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "134464 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8823,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "137323 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8823,
            "unit": "ns/op",
            "extra": "137323 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "137323 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "137323 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9023,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "147872 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9023,
            "unit": "ns/op",
            "extra": "147872 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "147872 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "147872 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9085,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "115300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9085,
            "unit": "ns/op",
            "extra": "115300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "115300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "115300 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8776,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "138454 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8776,
            "unit": "ns/op",
            "extra": "138454 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "138454 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "138454 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8617,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "138352 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8617,
            "unit": "ns/op",
            "extra": "138352 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "138352 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "138352 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8554,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "145304 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8554,
            "unit": "ns/op",
            "extra": "145304 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "145304 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "145304 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 8787,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "130668 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 8787,
            "unit": "ns/op",
            "extra": "130668 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "130668 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "130668 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 809.2,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1474339 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 809.2,
            "unit": "ns/op",
            "extra": "1474339 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1474339 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1474339 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 811.5,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1477008 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 811.5,
            "unit": "ns/op",
            "extra": "1477008 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1477008 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1477008 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 808.1,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1484744 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 808.1,
            "unit": "ns/op",
            "extra": "1484744 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1484744 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1484744 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 816.2,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1467156 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 816.2,
            "unit": "ns/op",
            "extra": "1467156 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1467156 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1467156 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 802.7,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1495860 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 802.7,
            "unit": "ns/op",
            "extra": "1495860 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1495860 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1495860 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 807.1,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1479091 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 807.1,
            "unit": "ns/op",
            "extra": "1479091 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1479091 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1479091 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 806.8,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1487889 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 806.8,
            "unit": "ns/op",
            "extra": "1487889 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1487889 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1487889 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 909,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1277259 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 909,
            "unit": "ns/op",
            "extra": "1277259 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1277259 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1277259 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 806.4,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1489138 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 806.4,
            "unit": "ns/op",
            "extra": "1489138 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1489138 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1489138 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 814.9,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1460785 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 814.9,
            "unit": "ns/op",
            "extra": "1460785 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1460785 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1460785 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1687,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "657418 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1687,
            "unit": "ns/op",
            "extra": "657418 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "657418 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "657418 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1739,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "653274 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1739,
            "unit": "ns/op",
            "extra": "653274 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "653274 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "653274 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1681,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "679102 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1681,
            "unit": "ns/op",
            "extra": "679102 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "679102 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "679102 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1683,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "667558 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1683,
            "unit": "ns/op",
            "extra": "667558 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "667558 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "667558 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1680,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "691080 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1680,
            "unit": "ns/op",
            "extra": "691080 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "691080 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "691080 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1679,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "698737 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1679,
            "unit": "ns/op",
            "extra": "698737 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "698737 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "698737 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1678,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "713499 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1678,
            "unit": "ns/op",
            "extra": "713499 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "713499 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "713499 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1676,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "710948 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1676,
            "unit": "ns/op",
            "extra": "710948 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "710948 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "710948 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1698,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "653859 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1698,
            "unit": "ns/op",
            "extra": "653859 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "653859 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "653859 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1712,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "645097 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1712,
            "unit": "ns/op",
            "extra": "645097 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "645097 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "645097 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1791,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "617649 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1791,
            "unit": "ns/op",
            "extra": "617649 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "617649 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "617649 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1783,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "636120 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1783,
            "unit": "ns/op",
            "extra": "636120 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "636120 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "636120 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1786,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "629536 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1786,
            "unit": "ns/op",
            "extra": "629536 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "629536 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "629536 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1792,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "650572 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1792,
            "unit": "ns/op",
            "extra": "650572 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "650572 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "650572 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1790,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "602217 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1790,
            "unit": "ns/op",
            "extra": "602217 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "602217 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "602217 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1792,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "660910 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1792,
            "unit": "ns/op",
            "extra": "660910 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "660910 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "660910 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1787,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "624390 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1787,
            "unit": "ns/op",
            "extra": "624390 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "624390 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "624390 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1804,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "647212 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1804,
            "unit": "ns/op",
            "extra": "647212 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "647212 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "647212 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1798,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "643916 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1798,
            "unit": "ns/op",
            "extra": "643916 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "643916 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "643916 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1780,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "639350 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1780,
            "unit": "ns/op",
            "extra": "639350 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "639350 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "639350 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2748,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "427398 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2748,
            "unit": "ns/op",
            "extra": "427398 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "427398 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "427398 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2698,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "417350 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2698,
            "unit": "ns/op",
            "extra": "417350 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "417350 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "417350 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2706,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "406668 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2706,
            "unit": "ns/op",
            "extra": "406668 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "406668 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "406668 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2691,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "442389 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2691,
            "unit": "ns/op",
            "extra": "442389 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "442389 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "442389 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2727,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "419366 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2727,
            "unit": "ns/op",
            "extra": "419366 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "419366 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "419366 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2685,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "429229 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2685,
            "unit": "ns/op",
            "extra": "429229 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "429229 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "429229 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2698,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "447949 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2698,
            "unit": "ns/op",
            "extra": "447949 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "447949 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "447949 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2678,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "431553 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2678,
            "unit": "ns/op",
            "extra": "431553 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "431553 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "431553 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2712,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "430060 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2712,
            "unit": "ns/op",
            "extra": "430060 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "430060 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "430060 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2673,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "449326 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2673,
            "unit": "ns/op",
            "extra": "449326 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "449326 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "449326 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1313,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "911050 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1313,
            "unit": "ns/op",
            "extra": "911050 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "911050 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "911050 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1339,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "797150 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1339,
            "unit": "ns/op",
            "extra": "797150 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "797150 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "797150 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1359,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "866688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1359,
            "unit": "ns/op",
            "extra": "866688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "866688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "866688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1316,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "832280 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1316,
            "unit": "ns/op",
            "extra": "832280 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "832280 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "832280 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1314,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "884689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1314,
            "unit": "ns/op",
            "extra": "884689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "884689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "884689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1348,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "882224 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1348,
            "unit": "ns/op",
            "extra": "882224 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "882224 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "882224 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1340,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "880646 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1340,
            "unit": "ns/op",
            "extra": "880646 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "880646 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "880646 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1310,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "803346 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1310,
            "unit": "ns/op",
            "extra": "803346 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "803346 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "803346 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1318,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "893437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1318,
            "unit": "ns/op",
            "extra": "893437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "893437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "893437 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1327,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "852998 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1327,
            "unit": "ns/op",
            "extra": "852998 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "852998 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "852998 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2058,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "573936 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2058,
            "unit": "ns/op",
            "extra": "573936 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "573936 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "573936 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2074,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "582757 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2074,
            "unit": "ns/op",
            "extra": "582757 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "582757 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "582757 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2080,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "530833 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2080,
            "unit": "ns/op",
            "extra": "530833 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "530833 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "530833 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2080,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "545667 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2080,
            "unit": "ns/op",
            "extra": "545667 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "545667 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "545667 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2082,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "527246 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2082,
            "unit": "ns/op",
            "extra": "527246 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "527246 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "527246 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2051,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "576693 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2051,
            "unit": "ns/op",
            "extra": "576693 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "576693 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "576693 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2098,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "569358 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2098,
            "unit": "ns/op",
            "extra": "569358 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "569358 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "569358 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2074,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "547383 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2074,
            "unit": "ns/op",
            "extra": "547383 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "547383 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "547383 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2070,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "517311 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2070,
            "unit": "ns/op",
            "extra": "517311 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "517311 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "517311 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2059,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "528405 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2059,
            "unit": "ns/op",
            "extra": "528405 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "528405 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "528405 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4140,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "294882 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4140,
            "unit": "ns/op",
            "extra": "294882 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "294882 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "294882 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4100,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "286959 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4100,
            "unit": "ns/op",
            "extra": "286959 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "286959 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "286959 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4089,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "272958 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4089,
            "unit": "ns/op",
            "extra": "272958 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "272958 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "272958 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4040,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "288217 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4040,
            "unit": "ns/op",
            "extra": "288217 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "288217 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "288217 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4103,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "279147 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4103,
            "unit": "ns/op",
            "extra": "279147 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "279147 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "279147 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4059,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "287179 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4059,
            "unit": "ns/op",
            "extra": "287179 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "287179 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "287179 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4038,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "299209 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4038,
            "unit": "ns/op",
            "extra": "299209 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "299209 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "299209 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4020,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "290714 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4020,
            "unit": "ns/op",
            "extra": "290714 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "290714 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "290714 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4015,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "297688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4015,
            "unit": "ns/op",
            "extra": "297688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "297688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "297688 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4066,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "278932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4066,
            "unit": "ns/op",
            "extra": "278932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "278932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "278932 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5507,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "200436 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5507,
            "unit": "ns/op",
            "extra": "200436 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "200436 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "200436 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5259,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "204646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5259,
            "unit": "ns/op",
            "extra": "204646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "204646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "204646 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5324,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "231261 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5324,
            "unit": "ns/op",
            "extra": "231261 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "231261 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "231261 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5312,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "226005 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5312,
            "unit": "ns/op",
            "extra": "226005 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "226005 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "226005 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5304,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "232766 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5304,
            "unit": "ns/op",
            "extra": "232766 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "232766 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "232766 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5165,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "231254 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5165,
            "unit": "ns/op",
            "extra": "231254 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "231254 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "231254 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6250,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "227649 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6250,
            "unit": "ns/op",
            "extra": "227649 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "227649 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "227649 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5314,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "209685 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5314,
            "unit": "ns/op",
            "extra": "209685 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "209685 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "209685 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5632,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "214554 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5632,
            "unit": "ns/op",
            "extra": "214554 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "214554 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "214554 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 5405,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "194230 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 5405,
            "unit": "ns/op",
            "extra": "194230 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "194230 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "194230 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24711,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48573 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24711,
            "unit": "ns/op",
            "extra": "48573 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48573 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48573 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24546,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48847 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24546,
            "unit": "ns/op",
            "extra": "48847 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48847 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48847 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24758,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "47810 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24758,
            "unit": "ns/op",
            "extra": "47810 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "47810 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "47810 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24811,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48494 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24811,
            "unit": "ns/op",
            "extra": "48494 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48494 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48494 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24572,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48740 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24572,
            "unit": "ns/op",
            "extra": "48740 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48740 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48740 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24801,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48903 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24801,
            "unit": "ns/op",
            "extra": "48903 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48903 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48903 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24690,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48770 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24690,
            "unit": "ns/op",
            "extra": "48770 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48770 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48770 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24998,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "47485 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24998,
            "unit": "ns/op",
            "extra": "47485 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "47485 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "47485 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24812,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "48382 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24812,
            "unit": "ns/op",
            "extra": "48382 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "48382 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48382 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 24762,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "48667 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 24762,
            "unit": "ns/op",
            "extra": "48667 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "48667 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "48667 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33481,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "36217 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33481,
            "unit": "ns/op",
            "extra": "36217 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "36217 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "36217 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33782,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34870 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33782,
            "unit": "ns/op",
            "extra": "34870 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34870 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34870 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33298,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "35932 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33298,
            "unit": "ns/op",
            "extra": "35932 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "35932 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35932 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34222,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35959 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34222,
            "unit": "ns/op",
            "extra": "35959 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35959 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35959 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33088,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "36114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33088,
            "unit": "ns/op",
            "extra": "36114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "36114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "36114 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 33715,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "35817 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33715,
            "unit": "ns/op",
            "extra": "35817 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "35817 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35817 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34200,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34137 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34200,
            "unit": "ns/op",
            "extra": "34137 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34137 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34137 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34064,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "35475 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34064,
            "unit": "ns/op",
            "extra": "35475 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "35475 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35475 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34014,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "35092 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34014,
            "unit": "ns/op",
            "extra": "35092 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "35092 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "35092 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 34132,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34783 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34132,
            "unit": "ns/op",
            "extra": "34783 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34783 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34783 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32291,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36776 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32291,
            "unit": "ns/op",
            "extra": "36776 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36776 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36776 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31174,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39536 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31174,
            "unit": "ns/op",
            "extra": "39536 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39536 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39536 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31865,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "37998 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31865,
            "unit": "ns/op",
            "extra": "37998 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "37998 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "37998 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31011,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "36873 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31011,
            "unit": "ns/op",
            "extra": "36873 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "36873 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "36873 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31442,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "37028 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31442,
            "unit": "ns/op",
            "extra": "37028 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "37028 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "37028 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31471,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "38703 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31471,
            "unit": "ns/op",
            "extra": "38703 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "38703 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "38703 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31468,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39025 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31468,
            "unit": "ns/op",
            "extra": "39025 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39025 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39025 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 30389,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "39363 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 30389,
            "unit": "ns/op",
            "extra": "39363 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "39363 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "39363 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31543,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "38818 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31543,
            "unit": "ns/op",
            "extra": "38818 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "38818 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "38818 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 31249,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "38018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 31249,
            "unit": "ns/op",
            "extra": "38018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "38018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "38018 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 45744,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26278 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 45744,
            "unit": "ns/op",
            "extra": "26278 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26278 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26278 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 44579,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26515 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 44579,
            "unit": "ns/op",
            "extra": "26515 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26515 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26515 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 45895,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26656 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 45895,
            "unit": "ns/op",
            "extra": "26656 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26656 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26656 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 45092,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26283 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 45092,
            "unit": "ns/op",
            "extra": "26283 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26283 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26283 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 46331,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25921 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 46331,
            "unit": "ns/op",
            "extra": "25921 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25921 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25921 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 43916,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "27606 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 43916,
            "unit": "ns/op",
            "extra": "27606 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "27606 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "27606 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 44671,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26468 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 44671,
            "unit": "ns/op",
            "extra": "26468 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26468 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26468 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 46460,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "25269 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 46460,
            "unit": "ns/op",
            "extra": "25269 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "25269 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "25269 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 44779,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26754 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 44779,
            "unit": "ns/op",
            "extra": "26754 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26754 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26754 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 45374,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "26749 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 45374,
            "unit": "ns/op",
            "extra": "26749 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "26749 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "26749 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 27266,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "43104 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27266,
            "unit": "ns/op",
            "extra": "43104 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "43104 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "43104 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26572,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "45658 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26572,
            "unit": "ns/op",
            "extra": "45658 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "45658 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "45658 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26916,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "44942 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26916,
            "unit": "ns/op",
            "extra": "44942 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "44942 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44942 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26729,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "44492 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26729,
            "unit": "ns/op",
            "extra": "44492 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "44492 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44492 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26656,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "44517 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26656,
            "unit": "ns/op",
            "extra": "44517 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "44517 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44517 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26747,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "44694 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26747,
            "unit": "ns/op",
            "extra": "44694 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "44694 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44694 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 27437,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "42662 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27437,
            "unit": "ns/op",
            "extra": "42662 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "42662 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "42662 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26896,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "44582 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26896,
            "unit": "ns/op",
            "extra": "44582 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "44582 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "44582 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26758,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "43588 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26758,
            "unit": "ns/op",
            "extra": "43588 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "43588 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "43588 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 26631,
            "unit": "ns/op\t   31802 B/op\t     153 allocs/op",
            "extra": "45008 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26631,
            "unit": "ns/op",
            "extra": "45008 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31802,
            "unit": "B/op",
            "extra": "45008 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "45008 times\n2 procs"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "d418cc754fb3136e3e81ecfda55a08f46eea0225",
          "message": "docs(perf): record the live trend-dashboard URL + correct the private-Pages note\n\nThe org is on GHE/internal Pages, so the dashboard IS live (earlier note wrongly said\nit needed a paid feature). Document the access-controlled URL in perf-tracking.md\n(Phase 3) and the workflows README so it's findable:\nhttps://potential-barnacle-mvm429e.pages.github.io/dev/bench/ — random slug is GitHub's\nprivate-Pages hostname (stable; bookmark it), chart under /dev/bench/, bare root 404s.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T08:26:37+03:00",
          "tree_id": "fa7dcd2d7a5169e57de20be5b143abe3d14ae91a",
          "url": "https://github.com/stacklok/mecatl/commit/d418cc754fb3136e3e81ecfda55a08f46eea0225"
        },
        "date": 1781501534665,
        "tool": "go",
        "benches": [
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2248,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "472178 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2248,
            "unit": "ns/op",
            "extra": "472178 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "472178 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "472178 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2333,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "538093 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2333,
            "unit": "ns/op",
            "extra": "538093 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "538093 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "538093 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2318,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "518586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2318,
            "unit": "ns/op",
            "extra": "518586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "518586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "518586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2516,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "535278 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2516,
            "unit": "ns/op",
            "extra": "535278 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "535278 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "535278 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2249,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "553201 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2249,
            "unit": "ns/op",
            "extra": "553201 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "553201 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "553201 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2231,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "516152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2231,
            "unit": "ns/op",
            "extra": "516152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "516152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "516152 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2257,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "523975 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2257,
            "unit": "ns/op",
            "extra": "523975 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "523975 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "523975 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2232,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "570157 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2232,
            "unit": "ns/op",
            "extra": "570157 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "570157 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "570157 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2308,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "539817 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2308,
            "unit": "ns/op",
            "extra": "539817 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "539817 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "539817 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt)",
            "value": 2260,
            "unit": "ns/op\t    6224 B/op\t      21 allocs/op",
            "extra": "530500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 2260,
            "unit": "ns/op",
            "extra": "530500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 6224,
            "unit": "B/op",
            "extra": "530500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuild (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 21,
            "unit": "allocs/op",
            "extra": "530500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9667,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "121286 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9667,
            "unit": "ns/op",
            "extra": "121286 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "121286 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "121286 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 10493,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "103930 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 10493,
            "unit": "ns/op",
            "extra": "103930 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "103930 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "103930 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 10003,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "128446 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 10003,
            "unit": "ns/op",
            "extra": "128446 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "128446 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "128446 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9779,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "122767 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9779,
            "unit": "ns/op",
            "extra": "122767 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "122767 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "122767 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9412,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "130630 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9412,
            "unit": "ns/op",
            "extra": "130630 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "130630 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "130630 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 10174,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "128882 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 10174,
            "unit": "ns/op",
            "extra": "128882 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "128882 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "128882 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9830,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "122972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9830,
            "unit": "ns/op",
            "extra": "122972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "122972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "122972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9729,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "118586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9729,
            "unit": "ns/op",
            "extra": "118586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "118586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "118586 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9436,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "126303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9436,
            "unit": "ns/op",
            "extra": "126303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "126303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "126303 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt)",
            "value": 9784,
            "unit": "ns/op\t   28536 B/op\t      32 allocs/op",
            "extra": "128955 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - ns/op",
            "value": 9784,
            "unit": "ns/op",
            "extra": "128955 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - B/op",
            "value": 28536,
            "unit": "B/op",
            "extra": "128955 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildLargeCatalog (github.com/stacklok/mecatl/engine/prompt) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "128955 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 936.7,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1279720 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 936.7,
            "unit": "ns/op",
            "extra": "1279720 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1279720 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1279720 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 944.5,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1278456 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 944.5,
            "unit": "ns/op",
            "extra": "1278456 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1278456 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1278456 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 941.5,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1273320 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 941.5,
            "unit": "ns/op",
            "extra": "1273320 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1273320 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1273320 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 946.4,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1268746 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 946.4,
            "unit": "ns/op",
            "extra": "1268746 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1268746 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1268746 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 936.7,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1279730 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 936.7,
            "unit": "ns/op",
            "extra": "1279730 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1279730 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1279730 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 948.5,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1265522 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 948.5,
            "unit": "ns/op",
            "extra": "1265522 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1265522 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1265522 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 947.5,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1270474 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 947.5,
            "unit": "ns/op",
            "extra": "1270474 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1270474 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1270474 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 1061,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1254656 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1061,
            "unit": "ns/op",
            "extra": "1254656 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1254656 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1254656 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 957.6,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1252837 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 957.6,
            "unit": "ns/op",
            "extra": "1252837 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1252837 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1252837 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance)",
            "value": 960.2,
            "unit": "ns/op\t     584 B/op\t      13 allocs/op",
            "extra": "1248195 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 960.2,
            "unit": "ns/op",
            "extra": "1248195 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 584,
            "unit": "B/op",
            "extra": "1248195 times\n2 procs"
          },
          {
            "name": "BenchmarkSplitCommands (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "1248195 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1850,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "657758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1850,
            "unit": "ns/op",
            "extra": "657758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "657758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "657758 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1835,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "629822 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1835,
            "unit": "ns/op",
            "extra": "629822 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "629822 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "629822 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1853,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "623815 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1853,
            "unit": "ns/op",
            "extra": "623815 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "623815 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "623815 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1834,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "654260 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1834,
            "unit": "ns/op",
            "extra": "654260 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "654260 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "654260 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1835,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "623725 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1835,
            "unit": "ns/op",
            "extra": "623725 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "623725 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "623725 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1845,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "591178 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1845,
            "unit": "ns/op",
            "extra": "591178 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "591178 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "591178 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1860,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "571140 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1860,
            "unit": "ns/op",
            "extra": "571140 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "571140 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "571140 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1822,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "663666 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1822,
            "unit": "ns/op",
            "extra": "663666 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "663666 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "663666 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1826,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "651926 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1826,
            "unit": "ns/op",
            "extra": "651926 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "651926 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "651926 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance)",
            "value": 1827,
            "unit": "ns/op\t     816 B/op\t      19 allocs/op",
            "extra": "619230 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1827,
            "unit": "ns/op",
            "extra": "619230 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 816,
            "unit": "B/op",
            "extra": "619230 times\n2 procs"
          },
          {
            "name": "BenchmarkReadOnlyBash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 19,
            "unit": "allocs/op",
            "extra": "619230 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1871,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "585631 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1871,
            "unit": "ns/op",
            "extra": "585631 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "585631 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "585631 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1868,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "622435 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1868,
            "unit": "ns/op",
            "extra": "622435 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "622435 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "622435 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1882,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "639303 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1882,
            "unit": "ns/op",
            "extra": "639303 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "639303 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "639303 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1905,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "620275 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1905,
            "unit": "ns/op",
            "extra": "620275 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "620275 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "620275 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1878,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "611542 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1878,
            "unit": "ns/op",
            "extra": "611542 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "611542 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "611542 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1877,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "620805 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1877,
            "unit": "ns/op",
            "extra": "620805 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "620805 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "620805 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1876,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "612909 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1876,
            "unit": "ns/op",
            "extra": "612909 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "612909 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "612909 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1881,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "619734 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1881,
            "unit": "ns/op",
            "extra": "619734 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "619734 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "619734 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1960,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "606055 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1960,
            "unit": "ns/op",
            "extra": "606055 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "606055 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "606055 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance)",
            "value": 1854,
            "unit": "ns/op\t     408 B/op\t      14 allocs/op",
            "extra": "596474 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1854,
            "unit": "ns/op",
            "extra": "596474 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 408,
            "unit": "B/op",
            "extra": "596474 times\n2 procs"
          },
          {
            "name": "BenchmarkSubstitutionReadOnly (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 14,
            "unit": "allocs/op",
            "extra": "596474 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2894,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "392062 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2894,
            "unit": "ns/op",
            "extra": "392062 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "392062 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "392062 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2915,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "404115 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2915,
            "unit": "ns/op",
            "extra": "404115 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "404115 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "404115 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2915,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "386191 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2915,
            "unit": "ns/op",
            "extra": "386191 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "386191 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "386191 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2906,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "410083 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2906,
            "unit": "ns/op",
            "extra": "410083 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "410083 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "410083 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2912,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "407769 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2912,
            "unit": "ns/op",
            "extra": "407769 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "407769 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "407769 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2962,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "401402 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2962,
            "unit": "ns/op",
            "extra": "401402 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "401402 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "401402 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2911,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "410868 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2911,
            "unit": "ns/op",
            "extra": "410868 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "410868 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "410868 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2906,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "397497 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2906,
            "unit": "ns/op",
            "extra": "397497 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "397497 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "397497 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2878,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "402322 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2878,
            "unit": "ns/op",
            "extra": "402322 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "402322 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "402322 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance)",
            "value": 2857,
            "unit": "ns/op\t    1272 B/op\t      32 allocs/op",
            "extra": "413008 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2857,
            "unit": "ns/op",
            "extra": "413008 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1272,
            "unit": "B/op",
            "extra": "413008 times\n2 procs"
          },
          {
            "name": "BenchmarkIsolationApprovable (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 32,
            "unit": "allocs/op",
            "extra": "413008 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1532,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "702064 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1532,
            "unit": "ns/op",
            "extra": "702064 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "702064 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "702064 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1554,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "800403 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1554,
            "unit": "ns/op",
            "extra": "800403 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "800403 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "800403 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1507,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "753445 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1507,
            "unit": "ns/op",
            "extra": "753445 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "753445 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "753445 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1506,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "759159 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1506,
            "unit": "ns/op",
            "extra": "759159 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "759159 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "759159 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1507,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "731028 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1507,
            "unit": "ns/op",
            "extra": "731028 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "731028 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "731028 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1506,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "796989 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1506,
            "unit": "ns/op",
            "extra": "796989 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "796989 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "796989 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1516,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "794960 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1516,
            "unit": "ns/op",
            "extra": "794960 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "794960 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "794960 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1547,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "718156 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1547,
            "unit": "ns/op",
            "extra": "718156 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "718156 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "718156 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1500,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "798372 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1500,
            "unit": "ns/op",
            "extra": "798372 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "798372 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "798372 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance)",
            "value": 1543,
            "unit": "ns/op\t     856 B/op\t      13 allocs/op",
            "extra": "716932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 1543,
            "unit": "ns/op",
            "extra": "716932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 856,
            "unit": "B/op",
            "extra": "716932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/simple-tool (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 13,
            "unit": "allocs/op",
            "extra": "716932 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2291,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "512844 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2291,
            "unit": "ns/op",
            "extra": "512844 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "512844 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "512844 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2352,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "486630 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2352,
            "unit": "ns/op",
            "extra": "486630 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "486630 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "486630 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2285,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "529915 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2285,
            "unit": "ns/op",
            "extra": "529915 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "529915 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "529915 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2318,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "500274 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2318,
            "unit": "ns/op",
            "extra": "500274 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "500274 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "500274 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2302,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "491532 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2302,
            "unit": "ns/op",
            "extra": "491532 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "491532 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "491532 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2439,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "485654 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2439,
            "unit": "ns/op",
            "extra": "485654 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "485654 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "485654 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2400,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "502375 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2400,
            "unit": "ns/op",
            "extra": "502375 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "502375 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "502375 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2299,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "520579 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2299,
            "unit": "ns/op",
            "extra": "520579 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "520579 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "520579 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2301,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "481909 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2301,
            "unit": "ns/op",
            "extra": "481909 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "481909 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "481909 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 2328,
            "unit": "ns/op\t     920 B/op\t      18 allocs/op",
            "extra": "504508 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 2328,
            "unit": "ns/op",
            "extra": "504508 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 920,
            "unit": "B/op",
            "extra": "504508 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/plain-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 18,
            "unit": "allocs/op",
            "extra": "504508 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4491,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "264127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4491,
            "unit": "ns/op",
            "extra": "264127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "264127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "264127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4482,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "259008 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4482,
            "unit": "ns/op",
            "extra": "259008 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "259008 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "259008 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4525,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "244834 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4525,
            "unit": "ns/op",
            "extra": "244834 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "244834 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "244834 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4488,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "260094 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4488,
            "unit": "ns/op",
            "extra": "260094 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "260094 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "260094 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4690,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "268456 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4690,
            "unit": "ns/op",
            "extra": "268456 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "268456 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "268456 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4512,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "261920 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4512,
            "unit": "ns/op",
            "extra": "261920 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "261920 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "261920 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4571,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "267127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4571,
            "unit": "ns/op",
            "extra": "267127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "267127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "267127 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4639,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "257689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4639,
            "unit": "ns/op",
            "extra": "257689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "257689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "257689 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4641,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "262603 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4641,
            "unit": "ns/op",
            "extra": "262603 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "262603 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "262603 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance)",
            "value": 4640,
            "unit": "ns/op\t    1544 B/op\t      29 allocs/op",
            "extra": "258254 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - ns/op",
            "value": 4640,
            "unit": "ns/op",
            "extra": "258254 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - B/op",
            "value": 1544,
            "unit": "B/op",
            "extra": "258254 times\n2 procs"
          },
          {
            "name": "BenchmarkEvaluatorEvaluate/compound-bash (github.com/stacklok/mecatl/engine/governance) - allocs/op",
            "value": 29,
            "unit": "allocs/op",
            "extra": "258254 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6849,
            "unit": "ns/op\t   12464 B/op\t      58 allocs/op",
            "extra": "170967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6849,
            "unit": "ns/op",
            "extra": "170967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "170967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "170967 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 7012,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "161540 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 7012,
            "unit": "ns/op",
            "extra": "161540 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "161540 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "161540 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6460,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "195547 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6460,
            "unit": "ns/op",
            "extra": "195547 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "195547 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "195547 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6602,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "164656 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6602,
            "unit": "ns/op",
            "extra": "164656 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "164656 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "164656 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6320,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "181381 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6320,
            "unit": "ns/op",
            "extra": "181381 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "181381 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "181381 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6838,
            "unit": "ns/op\t   12463 B/op\t      58 allocs/op",
            "extra": "175972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6838,
            "unit": "ns/op",
            "extra": "175972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12463,
            "unit": "B/op",
            "extra": "175972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 58,
            "unit": "allocs/op",
            "extra": "175972 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 7832,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "176599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 7832,
            "unit": "ns/op",
            "extra": "176599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "176599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "176599 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6597,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "162799 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6597,
            "unit": "ns/op",
            "extra": "162799 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "162799 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "162799 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6078,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "202530 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6078,
            "unit": "ns/op",
            "extra": "202530 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "202530 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "202530 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent)",
            "value": 6758,
            "unit": "ns/op\t   12464 B/op\t      59 allocs/op",
            "extra": "187500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 6758,
            "unit": "ns/op",
            "extra": "187500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 12464,
            "unit": "B/op",
            "extra": "187500 times\n2 procs"
          },
          {
            "name": "BenchmarkBuildRequest (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 59,
            "unit": "allocs/op",
            "extra": "187500 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 27130,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "44284 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27130,
            "unit": "ns/op",
            "extra": "44284 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "44284 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44284 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 27154,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "44025 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27154,
            "unit": "ns/op",
            "extra": "44025 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "44025 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44025 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26933,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "43738 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26933,
            "unit": "ns/op",
            "extra": "43738 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "43738 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "43738 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 27070,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 27070,
            "unit": "ns/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44944 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26984,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "44404 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26984,
            "unit": "ns/op",
            "extra": "44404 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "44404 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44404 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26741,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "44246 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26741,
            "unit": "ns/op",
            "extra": "44246 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "44246 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44246 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26877,
            "unit": "ns/op\t   15436 B/op\t     199 allocs/op",
            "extra": "45262 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26877,
            "unit": "ns/op",
            "extra": "45262 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15436,
            "unit": "B/op",
            "extra": "45262 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "45262 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26795,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "44109 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26795,
            "unit": "ns/op",
            "extra": "44109 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "44109 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44109 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26408,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "45824 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26408,
            "unit": "ns/op",
            "extra": "45824 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "45824 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "45824 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 26899,
            "unit": "ns/op\t   15435 B/op\t     199 allocs/op",
            "extra": "44211 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 26899,
            "unit": "ns/op",
            "extra": "44211 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 15435,
            "unit": "B/op",
            "extra": "44211 times\n2 procs"
          },
          {
            "name": "BenchmarkHeuristicCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 199,
            "unit": "allocs/op",
            "extra": "44211 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35342,
            "unit": "ns/op\t   29535 B/op\t     249 allocs/op",
            "extra": "33441 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35342,
            "unit": "ns/op",
            "extra": "33441 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29535,
            "unit": "B/op",
            "extra": "33441 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33441 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 36940,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "33193 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36940,
            "unit": "ns/op",
            "extra": "33193 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "33193 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33193 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35982,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "33808 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35982,
            "unit": "ns/op",
            "extra": "33808 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "33808 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33808 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 36156,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "32599 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36156,
            "unit": "ns/op",
            "extra": "32599 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "32599 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "32599 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35234,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34227 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35234,
            "unit": "ns/op",
            "extra": "34227 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34227 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34227 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 36041,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "33615 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36041,
            "unit": "ns/op",
            "extra": "33615 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "33615 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "33615 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35921,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "32892 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35921,
            "unit": "ns/op",
            "extra": "32892 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "32892 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "32892 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 36324,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "31903 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36324,
            "unit": "ns/op",
            "extra": "31903 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "31903 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "31903 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 35570,
            "unit": "ns/op\t   29534 B/op\t     249 allocs/op",
            "extra": "34056 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35570,
            "unit": "ns/op",
            "extra": "34056 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29534,
            "unit": "B/op",
            "extra": "34056 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "34056 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent)",
            "value": 36575,
            "unit": "ns/op\t   29533 B/op\t     249 allocs/op",
            "extra": "32290 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36575,
            "unit": "ns/op",
            "extra": "32290 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 29533,
            "unit": "B/op",
            "extra": "32290 times\n2 procs"
          },
          {
            "name": "BenchmarkCascadeCompact (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 249,
            "unit": "allocs/op",
            "extra": "32290 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 37001,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "33741 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 37001,
            "unit": "ns/op",
            "extra": "33741 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "33741 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "33741 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 37458,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "32578 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 37458,
            "unit": "ns/op",
            "extra": "32578 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "32578 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "32578 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 38512,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "30796 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 38512,
            "unit": "ns/op",
            "extra": "30796 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "30796 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "30796 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 35513,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "34143 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35513,
            "unit": "ns/op",
            "extra": "34143 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "34143 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "34143 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 36090,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "33835 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36090,
            "unit": "ns/op",
            "extra": "33835 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "33835 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "33835 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 34985,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "34317 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34985,
            "unit": "ns/op",
            "extra": "34317 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "34317 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "34317 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 36621,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "32697 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36621,
            "unit": "ns/op",
            "extra": "32697 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "32697 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "32697 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 36157,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "31558 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36157,
            "unit": "ns/op",
            "extra": "31558 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "31558 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "31558 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 36705,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "32961 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36705,
            "unit": "ns/op",
            "extra": "32961 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "32961 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "32961 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 35782,
            "unit": "ns/op\t   32675 B/op\t     158 allocs/op",
            "extra": "33562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35782,
            "unit": "ns/op",
            "extra": "33562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 32675,
            "unit": "B/op",
            "extra": "33562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadOnlyTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 158,
            "unit": "allocs/op",
            "extra": "33562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 52573,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "22641 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 52573,
            "unit": "ns/op",
            "extra": "22641 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "22641 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "22641 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 52124,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "22532 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 52124,
            "unit": "ns/op",
            "extra": "22532 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "22532 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "22532 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 52222,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "23166 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 52222,
            "unit": "ns/op",
            "extra": "23166 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "23166 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "23166 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 52389,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "22345 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 52389,
            "unit": "ns/op",
            "extra": "22345 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "22345 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "22345 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 53607,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "22562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 53607,
            "unit": "ns/op",
            "extra": "22562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "22562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "22562 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 52664,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "23052 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 52664,
            "unit": "ns/op",
            "extra": "23052 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "23052 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "23052 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 53862,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "21177 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 53862,
            "unit": "ns/op",
            "extra": "21177 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "21177 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "21177 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 51604,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "23503 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 51604,
            "unit": "ns/op",
            "extra": "23503 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "23503 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "23503 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 51175,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "23529 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 51175,
            "unit": "ns/op",
            "extra": "23529 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "23529 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "23529 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 48815,
            "unit": "ns/op\t   38563 B/op\t     222 allocs/op",
            "extra": "24667 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 48815,
            "unit": "ns/op",
            "extra": "24667 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 38563,
            "unit": "B/op",
            "extra": "24667 times\n2 procs"
          },
          {
            "name": "BenchmarkRunReadParallelTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 222,
            "unit": "allocs/op",
            "extra": "24667 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32174,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32174,
            "unit": "ns/op",
            "extra": "37170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37170 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32843,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "38886 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32843,
            "unit": "ns/op",
            "extra": "38886 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "38886 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "38886 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32293,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37908 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32293,
            "unit": "ns/op",
            "extra": "37908 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37908 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37908 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 34245,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "35680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34245,
            "unit": "ns/op",
            "extra": "35680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "35680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "35680 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 34643,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "34497 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34643,
            "unit": "ns/op",
            "extra": "34497 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "34497 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "34497 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 33138,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "35688 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 33138,
            "unit": "ns/op",
            "extra": "35688 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "35688 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "35688 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 32564,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37737 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 32564,
            "unit": "ns/op",
            "extra": "37737 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37737 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37737 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 35803,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "34551 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 35803,
            "unit": "ns/op",
            "extra": "34551 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "34551 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "34551 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 36904,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "34466 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 36904,
            "unit": "ns/op",
            "extra": "34466 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "34466 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "34466 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent)",
            "value": 34502,
            "unit": "ns/op\t   31803 B/op\t     153 allocs/op",
            "extra": "37575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - ns/op",
            "value": 34502,
            "unit": "ns/op",
            "extra": "37575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - B/op",
            "value": 31803,
            "unit": "B/op",
            "extra": "37575 times\n2 procs"
          },
          {
            "name": "BenchmarkRunMutatingTurn (github.com/stacklok/mecatl/engine/agent) - allocs/op",
            "value": 153,
            "unit": "allocs/op",
            "extra": "37575 times\n2 procs"
          }
        ]
      }
    ],
    "mecatl scenarios (smaller-is-better)": [
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "769966850abfbb437ec70eda7ce4c911ec12e289",
          "message": "docs(skills): cross-reference PGO in the perf-optimization skill\n\nAdd a brief \"Complementary: PGO\" section + a PGO trigger keyword to the description,\nso the skill covers the profile-guided-optimization lever (task pgo:collect, the\ncmd/mecated/default.pgo auto-pickup, the don't-commit-an-offline-profile rule) and a\n\"how do I PGO mecatl\" question routes here. Detail is not duplicated — it points to\nperf-tracking.md Phase 4 for the full rationale + production refresh process.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T07:46:19+03:00",
          "tree_id": "63d17d732ffd7b3db70262ef63d3d75c94ea0328",
          "url": "https://github.com/stacklok/mecatl/commit/769966850abfbb437ec70eda7ce4c911ec12e289"
        },
        "date": 1781500261322,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "background_subagents/allocs_per_op",
            "value": 1465.5,
            "unit": "allocs/op"
          },
          {
            "name": "background_subagents/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "background_subagents/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "compaction_cycle/allocs_per_op",
            "value": 4079,
            "unit": "allocs/op"
          },
          {
            "name": "compaction_cycle/tokens_total",
            "value": 40110,
            "unit": "tokens"
          },
          {
            "name": "compaction_cycle/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "single_session_long/allocs_per_op",
            "value": 35128,
            "unit": "allocs/op"
          },
          {
            "name": "single_session_long/tokens_total",
            "value": 521040,
            "unit": "tokens"
          },
          {
            "name": "single_session_long/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "team_fanout/allocs_per_op",
            "value": 2415,
            "unit": "allocs/op"
          },
          {
            "name": "team_fanout/tokens_total",
            "value": 12880,
            "unit": "tokens"
          },
          {
            "name": "team_fanout/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "tui_scrollback_view/allocs_per_op",
            "value": 7124.5,
            "unit": "allocs/op"
          },
          {
            "name": "tui_scrollback_view/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "tui_scrollback_view/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "tui_scrollback_view_steady/allocs_per_op",
            "value": 95.5,
            "unit": "allocs/op"
          },
          {
            "name": "tui_scrollback_view_steady/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "tui_scrollback_view_steady/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "d1f6d53bfd753ddd06b95aa556f960548ad47992",
          "message": "ci(perf): fetch the allocs baseline via authenticated gh api (private-repo safe)\n\nThe first perf-main run failed: github-action-benchmark's auto-push fetches the\ngh-pages branch before it can create it, and the branch didn't exist\n(`fatal: couldn't find remote ref gh-pages`). Bootstrapped gh-pages as an empty\norphan branch (one-time) so the action can fetch+push it.\n\nSeparately, the allocs-gate baseline was fetched via `curl raw.githubusercontent.com`,\nwhich is UNAUTHENTICATED and 404s on a private repo (this repo is private) — silently\nsinking the micro allocs gate into its skip path on every PR. Switch both fetch sites\n(perf-pr + perf-main) to authenticated `gh api ...contents...?ref=gh-pages` with the\nGITHUB_TOKEN; a failed fetch still leaves NO file so allocsgate takes its absent→skip\npath (not present-but-empty→fail-loud). The trend store + the github-action-benchmark\nscenario gates were already private-safe (authenticated git via GITHUB_TOKEN); only\nthe raw-URL micro-baseline fetch was broken. Documented the private-repo posture +\nthe gh-pages bootstrap requirement in perf-tracking.md.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T08:09:38+03:00",
          "tree_id": "9bee2bf24954b44412d9a1680f7af13b9fd71adb",
          "url": "https://github.com/stacklok/mecatl/commit/d1f6d53bfd753ddd06b95aa556f960548ad47992"
        },
        "date": 1781500591273,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "background_subagents/allocs_per_op",
            "value": 1467,
            "unit": "allocs/op"
          },
          {
            "name": "background_subagents/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "background_subagents/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "compaction_cycle/allocs_per_op",
            "value": 4079,
            "unit": "allocs/op"
          },
          {
            "name": "compaction_cycle/tokens_total",
            "value": 40110,
            "unit": "tokens"
          },
          {
            "name": "compaction_cycle/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "single_session_long/allocs_per_op",
            "value": 35128,
            "unit": "allocs/op"
          },
          {
            "name": "single_session_long/tokens_total",
            "value": 521040,
            "unit": "tokens"
          },
          {
            "name": "single_session_long/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "team_fanout/allocs_per_op",
            "value": 2415,
            "unit": "allocs/op"
          },
          {
            "name": "team_fanout/tokens_total",
            "value": 12880,
            "unit": "tokens"
          },
          {
            "name": "team_fanout/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "tui_scrollback_view/allocs_per_op",
            "value": 7022,
            "unit": "allocs/op"
          },
          {
            "name": "tui_scrollback_view/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "tui_scrollback_view/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "tui_scrollback_view_steady/allocs_per_op",
            "value": 86,
            "unit": "allocs/op"
          },
          {
            "name": "tui_scrollback_view_steady/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "tui_scrollback_view_steady/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "111325e729b34214493d9d67d1a8065105cbbbec",
          "message": "fix(openai): human-readable message for response.incomplete content_filter\n\nA content_filter response.incomplete surfaced as the cryptic terminal\n`agent: stream: response incomplete: content_filter`, reading like a\nmecatl bug when it is an UPSTREAM moderation block (e.g. OpenRouter\nrouting gpt-5.5 to an Azure OpenAI upstream whose filter false-positives\non benign security/credentials wording).\n\nAdd incompleteMessage(), keyed on incomplete_details.reason: content_filter\nand max_output_tokens render plain-language messages (content_filter names\nit as upstream moderation, not a mecatl error, and hints to retype to\ncontinue — the session is failed-recoverable via #51); unknown/future\nreasons fall back byte-identically to `response incomplete: <reason>`.\n\nPresentation only — retry classification is untouched (content_filter\nstays a non-retryable bare error; replaying the prompt just trips it\nagain). Adapter-local, no port/LLMRequest change.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T08:11:43+03:00",
          "tree_id": "426daa2671d637cb0535013f3c38da673e4131ab",
          "url": "https://github.com/stacklok/mecatl/commit/111325e729b34214493d9d67d1a8065105cbbbec"
        },
        "date": 1781500921730,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "background_subagents/allocs_per_op",
            "value": 1466,
            "unit": "allocs/op"
          },
          {
            "name": "background_subagents/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "background_subagents/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "compaction_cycle/allocs_per_op",
            "value": 4079,
            "unit": "allocs/op"
          },
          {
            "name": "compaction_cycle/tokens_total",
            "value": 40110,
            "unit": "tokens"
          },
          {
            "name": "compaction_cycle/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "single_session_long/allocs_per_op",
            "value": 35128,
            "unit": "allocs/op"
          },
          {
            "name": "single_session_long/tokens_total",
            "value": 521040,
            "unit": "tokens"
          },
          {
            "name": "single_session_long/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "team_fanout/allocs_per_op",
            "value": 2415,
            "unit": "allocs/op"
          },
          {
            "name": "team_fanout/tokens_total",
            "value": 12880,
            "unit": "tokens"
          },
          {
            "name": "team_fanout/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "tui_scrollback_view/allocs_per_op",
            "value": 7106,
            "unit": "allocs/op"
          },
          {
            "name": "tui_scrollback_view/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "tui_scrollback_view/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          },
          {
            "name": "tui_scrollback_view_steady/allocs_per_op",
            "value": 96,
            "unit": "allocs/op"
          },
          {
            "name": "tui_scrollback_view_steady/tokens_total",
            "value": 0,
            "unit": "tokens"
          },
          {
            "name": "tui_scrollback_view_steady/goroutine_delta",
            "value": 0,
            "unit": "goroutines"
          }
        ]
      }
    ],
    "mecatl scenarios (bigger-is-better)": [
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "769966850abfbb437ec70eda7ce4c911ec12e289",
          "message": "docs(skills): cross-reference PGO in the perf-optimization skill\n\nAdd a brief \"Complementary: PGO\" section + a PGO trigger keyword to the description,\nso the skill covers the profile-guided-optimization lever (task pgo:collect, the\ncmd/mecated/default.pgo auto-pickup, the don't-commit-an-offline-profile rule) and a\n\"how do I PGO mecatl\" question routes here. Detail is not duplicated — it points to\nperf-tracking.md Phase 4 for the full rationale + production refresh process.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T07:46:19+03:00",
          "tree_id": "63d17d732ffd7b3db70262ef63d3d75c94ea0328",
          "url": "https://github.com/stacklok/mecatl/commit/769966850abfbb437ec70eda7ce4c911ec12e289"
        },
        "date": 1781500263469,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "single_session_long/cache_hit_rate",
            "value": 0.9,
            "unit": "ratio"
          },
          {
            "name": "team_fanout/cache_hit_rate",
            "value": 0.75,
            "unit": "ratio"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "committer": {
            "email": "ozz@stacklok.com",
            "name": "Juan Antonio Osorio",
            "username": "JAORMX"
          },
          "distinct": true,
          "id": "d1f6d53bfd753ddd06b95aa556f960548ad47992",
          "message": "ci(perf): fetch the allocs baseline via authenticated gh api (private-repo safe)\n\nThe first perf-main run failed: github-action-benchmark's auto-push fetches the\ngh-pages branch before it can create it, and the branch didn't exist\n(`fatal: couldn't find remote ref gh-pages`). Bootstrapped gh-pages as an empty\norphan branch (one-time) so the action can fetch+push it.\n\nSeparately, the allocs-gate baseline was fetched via `curl raw.githubusercontent.com`,\nwhich is UNAUTHENTICATED and 404s on a private repo (this repo is private) — silently\nsinking the micro allocs gate into its skip path on every PR. Switch both fetch sites\n(perf-pr + perf-main) to authenticated `gh api ...contents...?ref=gh-pages` with the\nGITHUB_TOKEN; a failed fetch still leaves NO file so allocsgate takes its absent→skip\npath (not present-but-empty→fail-loud). The trend store + the github-action-benchmark\nscenario gates were already private-safe (authenticated git via GITHUB_TOKEN); only\nthe raw-URL micro-baseline fetch was broken. Documented the private-repo posture +\nthe gh-pages bootstrap requirement in perf-tracking.md.\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>",
          "timestamp": "2026-06-15T08:09:38+03:00",
          "tree_id": "9bee2bf24954b44412d9a1680f7af13b9fd71adb",
          "url": "https://github.com/stacklok/mecatl/commit/d1f6d53bfd753ddd06b95aa556f960548ad47992"
        },
        "date": 1781500593079,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "single_session_long/cache_hit_rate",
            "value": 0.9,
            "unit": "ratio"
          },
          {
            "name": "team_fanout/cache_hit_rate",
            "value": 0.75,
            "unit": "ratio"
          }
        ]
      }
    ]
  }
}