---
id: parse-fmt01
status: closed
type: task
priority: 1
created: 2026-03-12T00:00:00Z
deps: []
links: [parse-agg01]
parent: epic-bot01
tags: [parsing, format, documentation]
---
# Document Message Format and Parsing Rules

Define the exact format of messages posted by the source bot that this bot needs to parse, and specify the parsing rules and data model.

## To Document

- Which channels will be monitored (exact channel names)
- The bot user ID or username of the source bot (so we filter only its messages)
- Example raw message strings showing all possible formats
- Which fields to extract from each message (e.g., player name, action type, value, timestamp)
- Edge cases: multi-line messages, embeds vs plain text, variations in format

Bot username: utopiabot

## Example Section (fill in)

```
Channel: #dragons

Example message 1:
:dragon_face: DRAGON Ill be there in a tick [ro#] donated 100,000 gold coins to fund dragon!

Fields extracted:
- province: I'll be there in a tick
- action: funded the dragon with gold
- value: 100,000 gold coins

Example message 2:
:dragon_face: DRAGON Time to Shine [Time%20to%20Shin#] donated 13,360 bushels to fund dragon!

Fields extracted:
- province: Time to Shine
- action: funded the dragon with bushels
- value: 13,360 bushels

Example message 3:
:dragon_face: DRAGON your time is up Give in [your%20time%20is%20up%20Give%20i#] donated 4,394 gold coins to fund dragon!

Fields extracted:
- province: your time is up Give in
- action: funded the dragon with gold
- value: 4,394 gold coins

Example message 4:
:dragon_face: DRAGON Slow Attack times [slow attack times] sent 700 troops and weakened dragon by 6484 points!

Fields extracted:
- province: Slow Attack times
- action: sent troops and weakened the dragon
- value: 700 troops and 6484 points



## Data Model (per province)

```
{
  province: string,         // province name as it appears in the message
  goldDonated: number,      // cumulative gold coins donated
  bushelsDonated: number,   // cumulative bushels donated
  troopsSent: number,       // cumulative troops sent to attack
  pointsWeakened: number    // cumulative dragon weakened-by points
}
```

## Regex Patterns

Donation:
```
/DRAGON (.+?) \[.+?\] donated ([\d,]+) (gold coins|bushels) to fund dragon!/
```
- Group 1: province name
- Group 2: amount (strip commas before parsing to int)
- Group 3: resource type

Attack:
```
/DRAGON (.+?) \[.+?\] sent ([\d,]+) troops and weakened dragon by ([\d,]+) points!/
```
- Group 1: province name
- Group 2: troops sent
- Group 3: points weakened

## Acceptance Criteria

- [x] At least 3 representative example messages documented
- [x] All fields to extract are named and typed
- [x] Channel list finalized (#dragons)
- [x] Source bot identified for filtering (utopiabot)
