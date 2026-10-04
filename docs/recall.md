# Recall probe — scope-strip detector

Precision is cheap to measure: hand-label what the detector fires on. Recall needs the
misses, so this probe runs a deliberately **loose screen** that is a strict superset of
anything the detector can see, then hand-labels everything the screen produced that the
detector did not flag.

## Screen

Any money value stated in a *bounded* retrieval answer that reappears verbatim in any chat
message within 21 days — no qualifier logic at all. On the default corpus this yields
**848 candidate pairs across 109 distinct values**. The detector had flagged 1.

## Census

All 109 unflagged values were hand-labelled (no sampling). Labels and categories are in
`docs/recall/labels.jsonl` (record ids, values and categories — no message text); the summary in
`docs/recall/report.json`.

| Why the value was correctly *not* a strip | n |
|---|---|
| price, cap, threshold, goal, contract — not a window measurement | 35 |
| same-day running total, no larger period implied | 24 |
| bound preserved in the restatement | 23 |
| same number, different quantity | 18 |
| completed result, legitimately unbounded | 4 |
| a gap or change, not a level | 2 |
| restated with a different (wrong) bound present | 1 |
| later message retracts the number | 1 |
| **true scope strip the detector missed** | **1** |

## The miss

`$355` — origin (explicit bound): *"raising a combined total of $355 across two separate
fundraisers **by Day 10**"* → 25 h later, another agent: *"**Origin Era (Apr 2025):** We
raised $355 … during our first coordinated charity drive."* Bound dropped, presented as the
era total; the real figure was ~$1,984. A second phantom fact, four months before the first,
by the same mechanism.

Three causes, all in the detector: the unbounded-qualifier vocabulary lacked era / first-campaign
framing; a bare month/year ("Apr 2025") was treated as a *preserved* bound when it is a *wider* one;
and the repair-language filter scanned the whole 17k-character message and matched "fixed" sections away.

## Result

| | true strips known | detected | recall (within screen) | false positives |
|---|---|---|---|---|
| before | 2 | 1 | **50%** | 0 |
| after | 2 | 2 | **100%** | 0 |

Both strips are HIGH tier: `$232` was contradicted by a human after 12 days, `$355` by an agent restating
the real total after 51 days. The contradiction search is topically anchored (a whole-period figure must
measure the same subject) after an unrelated "$2+ trillion all-time" sentence was matched, and a repudiation
must sit *adjacent* to the value after a "thanks for the correction! Total: ~$1,984" message was read as
denying the figure it affirmed. All fixes are pinned by tests.

## A third strip, at medium

The vocabulary fixes also surface `$1,984` — "By Day 37, the total reached $1,984" restated as
"HKI fundraiser ($1,984 total)". The bound was dropped, so it is a strip; but the campaign ended at that
figure, no later whole-period mention out-attests it, and nothing repudiates it adjacently, so it tiers
**medium**. Medium findings are counted in the pipeline but not emitted by default;
`tripwire scan --min-severity medium` includes them.

## Ceiling

The screen only sees money values repeated verbatim. Scope strips of other quantities (counts, dates,
percentages) and paraphrased numbers are invisible to the screen and the detector alike, so this recall
figure is relative to the screen, not the world.
