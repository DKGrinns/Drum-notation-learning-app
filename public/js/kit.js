// The drum kit and where each piece lives on the staff.
// `step` is the staff position: 0 = bottom line, each step is half a space up.
// Lines are at steps 0, 2, 4, 6, 8. Placement follows the common
// (Weinberg / PAS) drum-set notation key.
//
// Ordered top-to-bottom as it appears on the staff.
export const KIT = [
  { id: 'crash', name: 'Crash', label: 'Crash', step: 10, head: 'x', family: 'cym', key: 'u',
    where: 'on the ledger line above the staff, with an x notehead' },
  { id: 'hihat', name: 'Hi-hat', label: 'Hi-hat', step: 9, head: 'x', family: 'cym', key: 'j',
    where: 'in the space just above the staff, with an x notehead' },
  { id: 'ride', name: 'Ride', label: 'Ride', step: 8, head: 'x', family: 'cym', key: 'k',
    where: 'on the top line, with an x notehead' },
  { id: 'tom1', name: 'High tom', label: 'Tom 1', step: 7, head: 'o', family: 'drum', key: 'r',
    where: 'in the top space' },
  { id: 'tom2', name: 'Mid tom', label: 'Tom 2', step: 6, head: 'o', family: 'drum', key: 't',
    where: 'on the second line from the top' },
  { id: 'snare', name: 'Snare', label: 'Snare', step: 5, head: 'o', family: 'drum', key: 'f',
    where: 'in the third space up from the bottom' },
  { id: 'floor', name: 'Floor tom', label: 'Floor', step: 3, head: 'o', family: 'drum', key: 'v',
    where: 'in the second space up from the bottom' },
  { id: 'kick', name: 'Kick', label: 'Kick', step: 1, head: 'o', family: 'kick', key: ' ', keyLabel: 'Space',
    foot: true, where: 'in the bottom space, with its stem pointing down' },
  { id: 'hhfoot', name: 'Hi-hat foot', label: 'HH foot', step: -1, head: 'x', family: 'cym', key: 'n',
    foot: true, where: 'just below the staff, with an x notehead and its stem pointing down' },
];

export const byId = Object.fromEntries(KIT.map((k) => [k.id, k]));
