import type { APIRoute } from 'astro';
import { buildLlmsTxt } from '../lib/agent/llms';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
