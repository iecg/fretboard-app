# Strum Pattern Directions

Improve strum realism by adding `direction` fields to existing chord patterns that lack them. No new patterns, no structural changes — just annotating hits with up/down strum direction so the strum voice alternates note order.

## Motivation

The strum voice (`strumVoice.ts`) reverses voicing order for `direction: "up"`, mimicking a real up-stroke (highest string first → lowest last). Several patterns omit `direction`, so all their hits play as down-strums regardless of musical convention. This makes the strum instrument sound mechanical and one-dimensional, especially in genres like blues and reggae where alternating or up-stroke strums are fundamental to the feel.

## Convention

`direction` defaults to `"down"` when omitted. The established model (already followed by `pop-8ths`) is **constant hand motion**: a strumming hand oscillating at eighth-note rate plays down-strokes on the on-beats (0, 1, 2, 3) and up-strokes on the "&" off-beats (.5). New annotations follow this model, except where a genre convention overrides it (reggae skank is all up-strokes).

## Approach

Add `direction` to hits in three patterns where the strumming convention is clear and produces audibly different note order. Polyphonic voices (piano/organ) ignore `direction`, so the change is invisible for non-strum instruments.

### `shuffle-comp`
Used by Blues genre (currently organ, but user-selectable for strum). Blues guitar rhythm: strong downbeat anchor, lighter up-stroke pickup.

| Beat | Velocity | Direction |
|------|----------|-----------|
| 0    | 0.9      | down      |
| 1.5  | 0.6      | up        |

### `offbeat-skank`
Not genre-assigned, available in pattern dropdown. Reggae/ska up-stroke convention — all hits are up-strums. This is the one pattern with a real net change: every hit flips from the default down to up.

| Beat | Velocity | Direction |
|------|----------|-----------|
| 0.5  | 0.7      | up        |
| 1.5  | 0.7      | up        |
| 2.5  | 0.7      | up        |
| 3.5  | 0.7      | up        |

### `jazz-comp`
Used by Jazz genre (currently piano). Jazz guitar comping: down on the downbeat anchor, up on the off-beat pickups.

| Beat | Velocity | Direction | Style     |
|------|----------|-----------|-----------|
| 0    | 0.75     | down      | staccato  |
| 1.5  | 0.6      | up        | staccato  |
| 3.5  | 0.7      | up        | staccato  |

`shuffle-comp` beat 0 and `jazz-comp` beat 0 are already the default `down`; they are written explicitly to document intent alongside the up-strokes in the same pattern.

### Unchanged
- **`straight-quarters`**: Used by Pop genre (currently piano). On strum, the desired feel is a driving all-down-stroke quarter pulse — the hand resets in the air between hits. Since `direction` defaults to `"down"`, that feel is already the behavior; no annotation is needed. Left unchanged deliberately (not an oversight): alternating D-U-D-U on bare quarters would contradict the constant-hand-motion convention used elsewhere.
- **`ballad-whole`**: Single sustained hit — direction is meaningless.
- **`bossa-comp`**: Designed for rootless-jazz voicing engine with LH/RH split. Not a strum pattern.
- **`pop-8ths`**, **`funk-16th`**, **`funk-scratch`**, **`pop-syncopated-push`**: Already have direction annotations.

## Files Changed

- `src/progressions/audio/patterns.ts` — add `direction` to `shuffle-comp`, `offbeat-skank`, `jazz-comp`

## Testing

- Existing strum direction tests in `strumVoice.test.ts` should continue passing
- Manual: play each changed pattern with the strum instrument, verify audible up/down behavior matches the tables above (most audible on `offbeat-skank`, where all hits become up-strokes)
- No new tests needed — this is data-only, the direction handling is already tested

## Future Considerations

- Genre-to-pattern assignments could be revisited (e.g., Blues using strum instead of organ, with `shuffle-comp` as the pattern), but that's out of scope here.
