# MoonScope demo storyboard (30 seconds)

**Story in one line:** a lander is about to die at the lunar south pole; MoonScope shows why, and the smallest change that saves it.

Record at 1920 x 1080, browser zoom 110%, dark mode, no cursor wobble. Use the live site, not localhost.
Re-check every number below once the real NASA data is in (marked *).

| # | Time | Screen | What happens on screen | Voice-over |
| :- | :- | :- | :- | :- |
| 1 | 0-4 s | Rescue Mode (`#/rescue`), Dust storm | Battery bar turns red, forecast reads "Battery empty in 8 h" * | "Your lander just touched down at the Moon's south pole. In eight hours, its battery dies." |
| 2 | 4-9 s | Planner, Lander's-eye view | Press play on the timeline; the Sun slides behind the ridge, the panorama goes dark | "At the pole the Sun skims the horizon. One ridge can block it for days, and the same terrain can hide Earth." |
| 3 | 9-15 s | Planner, top of the page | Pick a site on the map, set the landing date; timeline and metrics update; verdict FEASIBLE | "MoonScope simulates every hour of the mission from NASA terrain and orbit data: sunlight, Earth contact and battery." |
| 4 | 15-20 s | Survival Calendar (`#/calendar`) | Red days appear; the earliest failing date is ringed * | "Then it stress-tests the plan. Land five days late, and the mission fails." |
| 5 | 20-26 s | Planner, Recommendations + What-if | Click Apply on "Land N days later" *; the verdict badge flips to green; the dashed scenario lines separate | "And it finds the smallest change that saves it." |
| 6 | 26-30 s | Rescue Mode result, then cover image | "Mission saved" card, cut to the cover | "MoonScope. Know before you land." |

## Shot checklist

- [ ] Reset the app before each take (reload the page)
- [ ] Rescue take: Malapert Massif, Dust storm; drive twice and tilt panels before sunset to win
- [ ] Planner take: start from a failing plan so the Apply click flips the verdict
- [ ] Captions on screen for every voice-over line (many judges watch muted)
- [ ] Music under the voice, quiet; no sound effects
- [ ] Export MP4 (H.264), under 30 seconds, 1080p

## Assets in this folder

| File | Use |
| :- | :- |
| `cover.svg` | Thumbnail / first and last frame (1280 x 720). Export to PNG from a browser if the form needs PNG |
| `screen-planner.png` | Key screenshot 1: the planner |
| `screen-rescue.png` | Key screenshot 2: Rescue Mode mid-crisis |
| `screen-calendar.png` | Key screenshot 3: Survival Calendar |

Re-take the three screenshots after the real data is in (T-19).