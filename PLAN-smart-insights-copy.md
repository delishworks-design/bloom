# Smart Insights copy rewrite

Status: implemented. Sleep wording B chosen.
Scope: presentation only. Engine stays untouched.

## Goal

Make Your week, Your focus, Good to know and Your next step read like calm,
constructed sentences instead of labelled fragments. Soothing, comforting,
inspiring, knowledgeable, easy to digest. No numbers in these four sections.
The Cycle card and charts keep the precise figures.

## Voice rules

- Second person, quiet and warm. No cheerleading, no scolding.
- Every section teaches one small thing.
- Short sentences, grade-six words.
- No numbers, units, counts, percentages or cycle day in these four sections.
- No exclamation, em dash, emoji, or question marks.
- Avoid the validator's banned phrases: self-care, journey, listen to your body,
  your data, your logs, tracking, pattern, insight, balance, wellness, remember,
  consider, based on your, it looks like, overall, great job, keep it up.
- Plain phase names: "the week before your period", "right after your period",
  "around ovulation". The Cycle card keeps the clinical name.
- Qualitative trend words from existing numbers: "a little less", "about the same",
  "clearly higher".
- Deterministic variation per day through the existing variant helper.

## Section shapes

- Your week: lead sentence that reflects the week back, one context sentence,
  one quiet recommendation. No bullets, no "Next 3 days" label.
- Your focus: goal chips stay. Two sentences: name the goal kindly, one small move
  with a fair timeframe.
- Good to know: two sentences. One body-literacy fact, one short plain-language note
  about how firm the history is.
- Your next step: one sentence naming the soft gap, short button verb.

## Rendering

- Replace `smartWeekTemplate` output with `{lead, body, closer}`.
- Keep `smartWeekValidate` for tone and safety, relaxed to sentences.
- Remove the action bullet list and its wrong label.
- Empty state uses `smartProgress`'s existing hint, spoken plainly.
- Unchanged: prediction, patterns, week compare, coming up, goal focus, facts,
  evidence registry, RO hiding, thresholds, section order.

## Copy bank

### Understand my cycle
- Week: Your cycle is finding its rhythm, and this week sits in the softer stretch
  before your period. The days ahead often ask for more rest and a little more
  patience. Notice what shows up, and the timing will keep getting clearer.
- Focus: Understanding your cycle is the goal you chose, and the shape of it is
  beginning to show. Keep noting how you feel each day, and let the weeks fill in
  the rest.
- Good to know: Cycle timing is a rough guess drawn from your own history, so it
  can move by a few days. A shift is normal, not a mistake.
- Next: A line about today is enough to keep the picture growing. / Log today

### Steadier energy
- Week: Energy held steadier this week, with fewer sharp dips than the week before.
  The steadier days lined up with fuller nights of sleep. That is worth noticing,
  and worth protecting when the week gets busy.
- Focus: Steadier energy is the goal you chose, and the shape of it is starting to
  lean your way. Plan the harder tasks for the hours that usually feel lighter, and
  let the quieter hours stay quiet.
- Good to know: Energy is your own reading of the day, so it reflects how you felt,
  not how much you did. Comparing weeks shows change without judging it.
- Next: One check-in tonight keeps the comparison honest. / Record today's energy

### Better sleep
- Week: Your nights ran shorter than the week before, and the dip arrived close to
  your period. Bodies often ask for more rest at that point, so this is a signal to
  answer, not a problem to fix. One earlier wind-down this week is enough to give
  the next one a fairer start.
- Focus: Better sleep is the goal you chose, and this week asked more of you than it
  gave back. Pick one wind-down cue and keep it for a week or two, then let the
  nights tell you if it helped.
- Good to know: Hours and quality are recorded separately, so a long night can still
  feel broken. Both matter, and neither one alone tells the whole story.
- Next: Tonight is the last easy chance to close this week with one honest night. /
  Log tonight's sleep

Alternatives under review for Better sleep:

- B, plainer: Sleep slipped this week, and most of the shorter nights came just
  before your period. Your body often asks for more rest then. An earlier bedtime
  on those nights is a small answer, and it gives next week a fairer start.
- C, softer: Your rest came in shorter stretches this week, and the dip settled
  near your period. That is a season the body knows, and it asks for softness
  rather than effort.

### Move more
- Week: Movement was lighter than the week before, and the quiet days lined up with
  lower energy. That reads as your body asking for a different pace, not a missed
  mark. A short walk on an open day is a kind way back in.
- Focus: Moving more is the goal you chose, and this week leaned toward rest. Start
  with a walk you would take anyway, and let it count.
- Good to know: A day counts as active here once you move for a stretch, not all at
  once. Small pieces add up the same.
- Next: A few minutes outside today would give next week a warmer start. / Record an
  activity

### Eat regularly
- Week: Meals were planned on most days, though one slot kept slipping. The gap is
  easy to spot once the week is laid out, and easy to close one day at a time. A
  little planning goes further than a perfect plan.
- Focus: Eating regularly is the goal you chose, and the rhythm is close. Fill the
  meal that keeps going missing, and let the rest stay simple.
- Good to know: A planned meal is a note to yourself, not proof that you ate it. The
  plan is there to make the day easier, not to keep score.
- Next: One missing meal is all this week needs from you. / Open meal planning

### Manage stress
- Week: Stress pressed higher than the week before, and most of it gathered in the
  days before your period. That stretch asks a lot of the body, and seeing it early
  makes room to soften it.
- Focus: Keeping stress steady is the goal you chose, and this week leaned heavy.
  One small routine, kept on the hard days, does more than a big plan saved for
  later.
- Good to know: A stress rating is your own reading of the day, not a measure of how
  well you coped. A higher reading is information, not failure.
- Next: A quiet minute before the day starts is enough. / Open Journal

### Prepare for doctor visits
- Week: Your records are gathered into one calm summary, ready to speak for you.
  Bring the questions you keep circling, because they belong in the room. You do not
  have to hold all of it in your head.
- Focus: A clear summary for your visit is the goal you chose, and the pieces are
  already in place. Read it once before you go, and add anything the week brings.
- Good to know: This summary holds your own notes for a visit, and it does not
  replace what a clinician sees in person. It is a starting point for the
  conversation, not a verdict.
- Next: One more note now makes the summary more complete. / Export health summary

## Tests

- Rewrite copy assertions in `tests/your-week.test.js` and
  `tests/smart-insights-ui.test.js`.
- Add a sweep over all seven goals: no digits, no banned words, sentence limits,
  no undefined or NaN, ends with a period.
- Engine tests in `tests/smart-goals.test.js` and `tests/smart-prediction.test.js`
  stay untouched.
- Verify with `node --check` and `node --test tests/*.test.js`.

## Files

- `index.html`: template, week renderer, focus renderer, knowledge map, CTA labels,
  empty line.
- Preview: `/root/smart-insights-preview.html`.
