# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cms-overlay.spec.ts >> CMS API >> entries list requires auth
- Location: e2e/cms-overlay.spec.ts:110:3

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:8787
Call log:
  - → GET http://localhost:8787/api/cms/entries
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```