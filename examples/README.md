# Example corpus

`demo.jsonl` is a four-record synthetic log in a domain unrelated to the default corpus:
a bounded retrieval ("by the end of January … $48,000"), a restatement with the bound dropped
("last quarter … in total"), a downstream use, and a human correction. `demo.map.json` maps
its fields onto Tripwire's record model.

```
tripwire scan --corpus generic --path examples/demo.jsonl --map examples/demo.map.json
tripwire ui
```

Expected: one HIGH `scope_strip` alert on `$48,000`, corrected by `human:dana`.
