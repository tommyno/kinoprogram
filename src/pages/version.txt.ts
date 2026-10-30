import type { APIRoute } from 'astro';
import { BUILD_ID } from '@lib/build.ts';

export const GET: APIRoute = () => new Response(BUILD_ID);
