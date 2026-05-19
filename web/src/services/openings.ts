// Small ECO-style opening table. Each entry is a SAN-move prefix → human name.
// Longest match wins. Covers the most common ~80 openings; deeper variations
// resolve to the parent opening (e.g. "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4" →
// "Ruy López, Morphy Defense" via the longest prefix match).
//
// Source: distilled from Wikipedia's ECO list. Not exhaustive, but good
// enough to put a name on the board for ~80% of casual games.

const OPENINGS: Array<[string, string]> = [
  // Open games (1.e4 e5)
  ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6', 'Ruy López, Morphy Defense'],
  ['e4 e5 Nf3 Nc6 Bb5 a6', 'Ruy López, Morphy Defense'],
  ['e4 e5 Nf3 Nc6 Bb5', 'Ruy López (Spanish)'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'Evans Gambit'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Italian Game, Two Knights'],
  ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'],
  ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'Four Knights Game'],
  ['e4 e5 Nf3 Nc6 d4', 'Scotch Game'],
  ['e4 e5 Nf3 Nf6', "Petrov's Defense"],
  ['e4 e5 Nf3 d6', 'Philidor Defense'],
  ['e4 e5 Nf3 Nc6', "King's Knight Opening"],
  ['e4 e5 f4', "King's Gambit"],
  ['e4 e5 Nc3', 'Vienna Game'],
  ['e4 e5 Bc4', "Bishop's Opening"],
  ['e4 e5', "Open Game (King's Pawn)"],

  // Semi-open
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian, Najdorf'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', 'Sicilian, Dragon'],
  ['e4 c5 Nf3 e6 d4 cxd4 Nxd4', 'Sicilian, Open (Taimanov / Paulsen)'],
  ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4', 'Sicilian, Open'],
  ['e4 c5 Nc3', 'Sicilian, Closed'],
  ['e4 c5', 'Sicilian Defense'],
  ['e4 e6 d4 d5 Nc3 Bb4', 'French, Winawer'],
  ['e4 e6 d4 d5 Nc3 Nf6', 'French, Classical'],
  ['e4 e6 d4 d5 e5', 'French, Advance'],
  ['e4 e6 d4 d5 exd5', 'French, Exchange'],
  ['e4 e6', 'French Defense'],
  ['e4 c6 d4 d5 Nc3 dxe4 Nxe4', 'Caro-Kann, Classical'],
  ['e4 c6 d4 d5 e5', 'Caro-Kann, Advance'],
  ['e4 c6 d4 d5 exd5 cxd5', 'Caro-Kann, Exchange'],
  ['e4 c6', 'Caro-Kann Defense'],
  ['e4 d6', 'Pirc Defense'],
  ['e4 g6', 'Modern Defense'],
  ['e4 Nf6', 'Alekhine Defense'],
  ['e4 d5', 'Scandinavian Defense'],
  ['e4 Nc6', 'Nimzowitsch Defense'],

  // Closed games (1.d4 d5)
  ['d4 d5 c4 e6 Nc3 Nf6 Bg5', 'QGD, Orthodox'],
  ['d4 d5 c4 e6 Nc3 Bb4', 'QGD, Ragozin'],
  ['d4 d5 c4 e6', 'Queen’s Gambit Declined'],
  ['d4 d5 c4 c6', 'Slav Defense'],
  ['d4 d5 c4 dxc4', 'Queen’s Gambit Accepted'],
  ['d4 d5 c4', "Queen's Gambit"],
  ['d4 d5 Nf3 Nf6 c4', "Queen's Gambit (delayed)"],
  ['d4 d5 Bf4', 'London System'],
  ['d4 d5 Nf3 Nf6 Bf4', 'London System'],
  ['d4 d5', 'Closed Game'],

  // Indian defenses (1.d4 Nf6)
  ['d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2', "King's Indian, Classical"],
  ['d4 Nf6 c4 g6 Nc3 Bg7', "King's Indian Defense"],
  ['d4 Nf6 c4 g6', "King's Indian / Grünfeld setup"],
  ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian'],
  ['d4 Nf6 c4 e6 Nf3 b6', 'Queen’s Indian'],
  ['d4 Nf6 c4 e6 Nf3 Bb4+', 'Bogo-Indian'],
  ['d4 Nf6 c4 e6', 'Indian Game'],
  ['d4 Nf6 c4 c5', 'Benoni Defense'],
  ['d4 Nf6 c4 e5', 'Budapest Gambit'],
  ['d4 Nf6 Bg5', 'Trompowsky'],
  ['d4 Nf6 Nf3 g6 c4 Bg7 Nc3 d5', 'Grünfeld Defense'],
  ['d4 Nf6 c4 g6 Nc3 d5', 'Grünfeld Defense'],
  ['d4 Nf6', 'Indian Defense'],

  // Dutch
  ['d4 f5', 'Dutch Defense'],

  // English
  ['c4 e5 Nc3 Nf6', 'English, Reversed Sicilian'],
  ['c4 c5', 'English, Symmetrical'],
  ['c4 Nf6', 'English, Anglo-Indian'],
  ['c4 e6', 'English, Agincourt'],
  ['c4', 'English Opening'],

  // Réti and flank
  ['Nf3 d5 c4', 'Réti Opening'],
  ['Nf3 Nf6 c4', 'Réti / English (transposition)'],
  ['Nf3 d5', 'Réti Opening'],
  ['Nf3', "Zukertort / King's Indian Attack"],
  ['b3', 'Larsen Opening'],
  ['g3', 'Benko Opening'],
  ['f4', 'Bird’s Opening'],
  ['b4', 'Sokolsky (Orangutan)'],

  // First-move-only fallbacks
  ['e4', "King's Pawn"],
  ['d4', "Queen's Pawn"],
]

// Pre-sort by descending length so longest match wins on linear scan.
const SORTED = [...OPENINGS].sort((a, b) => b[0].split(' ').length - a[0].split(' ').length)

/**
 * Match the longest opening prefix against the game's SAN move history.
 * Returns the opening name, or null if no opening matched.
 */
export function findOpening(history: string[]): string | null {
  if (history.length === 0) return null
  const joined = history.join(' ')
  for (const [prefix, name] of SORTED) {
    if (joined === prefix || joined.startsWith(prefix + ' ')) {
      return name
    }
  }
  return null
}
