export type Territory = {
  id: string;
  name: string;
  owner: string;
  note: string;
  col: number;
  row: number;
};

export type Battle = {
  id: string;
  date: string;
  attacker: string;
  defender: string;
  winner: string;
  mission: string;
  notes: string;
  createdAt: number;
};

export type RosterUnit = {
  id: string;
  name: string;
  xp: number;
  scars: string;
  notes: string;
};
