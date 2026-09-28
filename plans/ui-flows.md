# Host & guest UI flows

How people enter Split the Wine on mobile (and where web claimants join). Keep this in sync when entry points change.

## Host desk — two ways to start a tab

```mermaid
flowchart TD
  Home["Home — Host desk"]

  Home --> Icons["Top icons: upload / camera"]
  Home --> Start["Start a tab — always shown"]
  Home --> DraftCard["Unfinished draft card"]
  Home --> ActiveCard["Open / closed tab card"]
  Home --> Recent["Recent tabs list"]

  Icons --> ClearDraft{"Unfinished draft?"}
  ClearDraft -->|yes — confirm| CaptureAuto["/host/capture?launch=…"]
  ClearDraft -->|no| CaptureAuto

  CaptureAuto --> CamLib["System camera or library opens"]
  CamLib -->|photo taken| Parse["/host/parsing"]
  CamLib -->|cancel / dismiss| CaptureManual["Capture with Take photo / Library choices"]

  Start --> Ready["/host — Ready to split this check?"]
  Ready -->|fresh| CaptureManual2["/host/capture — pick photo"]
  Ready -->|has draft| Resume["Continue unfinished / Start fresh"]
  Resume --> MidStep["Resume at saved step"]
  Resume --> CaptureManual2

  CaptureManual --> Parse
  CaptureManual2 --> Parse

  DraftCard --> MidStep
  ActiveCard --> Live["Live board / settle"]
  Recent --> Live
```

## Host interview after the photo

```mermaid
flowchart LR
  Parse["Parsing"] --> Place["Confirm place"]
  Place --> Items["Review items"]
  Items --> Pour["Bottles / glasses"]
  Pour --> Fees["Tax and tip"]
  Fees --> Pay["Pay handles"]
  Pay --> Share["Share claim link"]
  Share --> Live["Live board"]
```

Parsing is a loading screen (no step count). Counted steps are Ready → Capture → Place → Items → Pour → Fees → Pay → Share (8). Ready is skipped on the icon shortcut path.

## Guest claim (web + app)

```mermaid
flowchart TD
  Link["Open claim link /r/:id"] --> Join["Join — name + optional contact"]
  Join --> Board["Claim board — pick lines"]
  Board --> Qty["Qty if needed"]
  Qty --> Settle["Settle — pay host"]
  Board -->|already claimed ≥1| Settle
  Settle -->|Pay now| Apps["Open Venmo / Cash App / …"]
  Settle -->|I'll pay later| Later["Copy / Share settle link"]
  Settle --> Board
```

## Notes

- **Start a tab** always stays on Home so canceling a camera shortcut never traps you without a guided way back in.
- Icon shortcuts clear the local draft (with confirm) then auto-open camera/library; cancel falls back to the normal capture choices.
- Web guests do not see Host desk; they only use the claim link path above.
