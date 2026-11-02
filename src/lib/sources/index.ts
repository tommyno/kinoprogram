import type { Source } from '../program.ts';
import { cinemaNeuf } from './cinemaneuf.ts';
import { cinemateket } from './cinemateket.ts';
import { deichman } from './deichman.ts';
import { filmweb } from './filmweb.ts';
import { revier } from './revier.ts';

// Every source the program is built from. A new one goes in its own file here, exporting a Source, and in this list
export const SOURCES: Source[] = [filmweb, cinemateket, cinemaNeuf, deichman, revier];
