# Strum Pattern Directions

Improve strum realism by adding `direction` fields to existing chord patterns that lack them. No new patterns, no structural changes — just annotating hits with up/down strum direction so the strum voice alternates note order.

## Motivation

The strum voice (`strumVoice.ts`) reverses voicing order for `direction: "up"`, mimicking a real up-stroke (highest string first → lowest last). Several patterns omit `direction`, so all their hits play as down-strums regardless of musical convention. This makes the strum instrument sound mechanical and one-dimensional, especially in genres like blues and pop where alternating strums are fundamental to the feel.

## Approach

Add `direction` to hits in four patterns where the strumming convention is clear. Polyphonic voices (piano/organ) ignore `direction`, so the change is invisible for non-strum instruments.

### `shuffle-comp`
Used by Blues genre (currently organ, but user-selectable for strum). Blues guitar rhythm: strong downbeat anchor, lighter up-stroke pickup.

| Beat | Velocity | Direction |
|------|----------|-----------|
| 0    | 0.9      | down      |
| 1.5  | 0.6      | up        |

### `straight-quarters`
Used by Pop genre (currently piano). When played on strum, folk/pop strumming naturally alternates down/up per quarter note.

| Beat | Velocity | Direction |
|------|----------|-----------|
| 0    | 0.8      | down      |
| 1    | 0.6      | up        |
| 2    | 0.7      | down      |
| 3    | 0.6      | up        |

### `offbeat-skank`
Not genre-assigned, available in pattern dropdown. Reggae/ska up-stroke convention — all hits are up-strums.

| Beat | Velocity | Direction |
|------|----------|-----------|
| 0.5  | 0.7      | up        |
| 1.5  | 0.7      | up        |
| 2.5  | 0.7      | up        |
| 3.5  | 0.7      | up        |

### `jazz-comp`
Used by Jazz genre (currently piano). Jazz guitar comping on the off-beats typically uses a down-up-down motion.

| Beat | Velocity | Direction | Style     |
|------|----------|-----------|-----------|
| 0    | 0.75     | down      | staccato  |
| 1.5  | 0.6      | up        | staccato  |
| 3.5  | 0.7      | up        | staccato  |

### Unchanged
- **`ballad-whole`**: Single sustained hit — direction is meaningless.
- **`bossa-comp`**: Designed for rootless-jazz voicing engine with LH/RH split. Not a strum pattern.
- **`pop-8ths`**, **`funk-16th`**, **`funk-scratch`**, **`pop-syncopated-push`**: Already have direction annotations.

## Files Changed

- `src/progressions/audio/patterns.ts` — add `direction` to `shuffle-comp`, `straight-quarters`, `offbeat-skank`, `jazz-comp`

## Testing

- Existing strum direction tests in `strumVoice.test.ts` should continue passing
- Manual: play each pattern with strum instrument, verify audible up/down alternation matches the table above
- No new tests needed — this is data-only, the direction handling is already tested

## Future Considerations

- Genre-to-pattern assignments could be revisited (e.g., Blues using strum instead of organ, with `shuffle-comp` as the pattern), but that's out of scope here.
