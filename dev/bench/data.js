window.BENCHMARK_DATA = {
  "lastUpdate": 1781500591869,
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
      }
    ]
  }
}