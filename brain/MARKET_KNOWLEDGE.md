1	# Greece Market Knowledge Base
2	*This file is the agent's long-term memory. Every run reads it first, adds to it last.*
3	*Format: [TYPE] | [FACT] | [SOURCE] | [CONFIDENCE] | [DATE ADDED] | [LAST VERIFIED]*
4	
5	---
6	
7	## Economy & Macro
8	STABLE_FACT | Greece GDP grew ~2.3% in 2024, outperforming EU average | IMF/Eurostat | high | 2026-03-27 | 2026-03-27
9	STABLE_FACT | Greece unemployment ~9.8% (2025), down from 27% peak in 2013 — still highest in eurozone | ELSTAT | high | 2026-03-27 | 2026-03-27
10	STABLE_FACT | Youth unemployment (15-24) remains ~20% — large pool of motivated, low-cost talent | ELSTAT | high | 2026-03-27 | 2026-03-27
11	STABLE_FACT | Greece receives ~€30B in EU structural funds through 2027 via Recovery & Resilience Plan | ec.europa.eu | high | 2026-03-27 | 2026-03-27
12	
13	## Tourism
14	STABLE_FACT | Tourism = ~25% of Greek GDP, ~30M visitors/year | INSETE | high | 2026-03-27 | 2026-03-27
15	TRACKED_SIGNAL | 2025 was record year for Greek tourism — 2026 projections show further growth especially shoulder seasons | INSETE | high | 2026-03-27 | 2026-03-27
16	TRACKED_SIGNAL | 2026 = "last-minute booking" year (ME geopolitics + EU household pressure); air capacity +7.8% (30.7M seats), Jul-Aug demand ~70% | INSETE/money-tourism | high | 2026-06-24 | 2026-06-24
17	STABLE_FACT | Average tourist spend in Greece €650-800/trip — higher for non-EU visitors | Bank of Greece | high | 2026-03-27 | 2026-03-27
18	MARKET_PATTERN | Greek islands are massively oversupplied in summer, deeply undersupplied in services in winter — two different markets | observation | high | 2026-03-27 | 2026-03-27
19	
20	## Digital Economy
21	STABLE_FACT | skroutz.gr has ~8M monthly users — Greek e-commerce is NOT underdeveloped, it's concentrated | skroutz.gr | high | 2026-03-27 | 2026-03-27
22	STABLE_FACT | e-food.gr (Efood) + Wolt dominate food delivery — third player has never succeeded | market observation | high | 2026-03-27 | 2026-03-27
23	TRACKED_SIGNAL | Greek government accelerating digital transformation — myAADE, myGov pushing citizens online | gov.gr | high | 2026-03-27 | 2026-03-27
24	MARKET_PATTERN | Greek SMEs are 5-7 years behind EU in digital adoption — massive service gap | European Commission SME report | high | 2026-03-27 | 2026-03-27
25	
26	## Consumer Behavior
27	MARKET_PATTERN | Greeks resist monthly subscriptions but accept one-time or annual payments | multiple observations | high | 2026-03-27 | 2026-03-27
28	MARKET_PATTERN | Personal relationships and referrals are the primary sales channel for small businesses in Greece | cultural observation | high | 2026-03-27 | 2026-03-27
29	MARKET_PATTERN | Greeks pay premium for authenticity, local provenance, and personal touch — not for brand names | observation | high | 2026-03-27 | 2026-03-27
30	
31	## Regulatory & Structural
32	STABLE_FACT | Digital nomad visa active since 2021 — allows non-EU remote workers to live in Greece 1 year (renewable) | minecon.gr | high | 2026-03-27 | 2026-03-27
33	STABLE_FACT | Starting a business in Greece still requires notary, GEMI registration, tax office visits — 15-30 days minimum | observation | high | 2026-03-27 | 2026-03-27
34	TRACKED_SIGNAL | Greek government reducing bureaucracy for freelancers and solo businesses (e-paravolo, online filings) | gov.gr | medium | 2026-03-27 | 2026-03-27
35	STABLE_FACT | Cash economy still large — estimates 20-25% of transactions unreported | Bank of Greece | medium | 2026-03-27 | 2026-03-27
36	STABLE_FACT | Mandatory B2B e-invoicing (XML to myDATA) starts 1 Oct 2026, transition to 31 Dec — hits ~700k freelancers/SMEs | parapolitika/jobbers | high | 2026-06-24 | 2026-06-24
37	STABLE_FACT | STR/Airbnb Law 5170/2025: EU unique registration number mandatory from 20 May 2026; fines from €5,000 | LiFO/newmoney/taxheaven | high | 2026-06-24 | 2026-06-24
38	STABLE_FACT | Tax reform Law 5246/2025: under-25s pay 0% income tax on first €20k; but min wage €830→€880 inflates imputed income, raising 2026 tax for ~700k freelancers | parapolitika/OECD | high | 2026-06-24 | 2026-06-24
39	STABLE_FACT | Digital nomad visa income floor raised to €3,5k/mo net; in-country applications abolished (Law 5275/2026) — barrier INCREASED | globalcitizensolutions | high | 2026-06-24 | 2026-06-24
40	
41	## New Specific Findings (June 2026)
42	STABLE_FACT | Approx. 35‑45% of Greek short‑term rental (STR) owners are non‑compliant with the 2026 EU registration number requirement | AADE/industry reports | high | 2026-06-24 | 2026-06-24
43	STABLE_FACT | Full‑service Airbnb compliance packages in Greece cost between €850 and €1,500 per property (one‑time) or €5‑€9 per month for SaaS solutions | PlusOil, EuroCheckin, ProofSnap | medium | 2026-06-24 | 2026-06-24
44	STABLE_FACT | Greek pet‑care services market (day‑care, boarding, pet‑sitting) valued at €55‑€65 million in 2026 | FinancialReport, 6W Research | high | 2026-06-24 | 2026-06-24
45	STABLE_FACT | Approx. 41% of STR owners are non‑compliant (48 000 owners out of > 116 000 active rentals) | Αθήνα 9,84 article (2026‑06‑02) | high | 2026-06-24 | 2026-06-24
46	---