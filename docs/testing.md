# Testing Report

## Current Status

**Automated unit and integration tests have not yet been implemented.** Given the assignment's 24-hour window, time was prioritized on getting the core feature set (auth, project CRUD, task CRUD, search, AI summaries, pagination, ownership/authorization checks) working correctly end-to-end first.

This section documents what has been **manually verified** during development, and what an automated test suite would cover next.

## Manual Verification Performed

| Flow | Method | Result |
|---|---|---|
| User registration | Manual request via Postman/curl | Works — duplicate email correctly rejected |
| User login | Manual request | Returns valid JWT |
| Protected route without token | Manual request, no `Authorization` header | Correctly returns 401 |
| Create project | Manual request | Project created, scoped to authenticated user |
| Update/delete project as non-owner | Manual request with a second user's token | Correctly returns 403 |
| Update/delete non-existent project | Manual request with a random UUID | Correctly returns 404 |
| Create task on a project you don't own | Manual request | Correctly returns 403 |
| Update task status as an unrelated user | Manual request | Correctly returns 403 |
| Task search scoping | Manual request, searched as User B for a task created by User A and not assigned to B | Correctly excluded from results |
| Pagination | Manual request with `?page=2&limit=5` on a seeded dataset | Returns correct slice and `totalPages` |
| AI summary generation | Manual request | Returns Gemini-generated summary on success |
| AI summary fallback | Manual request with an invalid `GEMINI_API_KEY` | Falls back to the rule-based summary instead of failing the request |

## Planned Automated Test Coverage

If continuing past this submission, the test suite would be structured as:

### Unit Tests (Jest)
- Input validation logic in each controller (empty title, missing required fields)
- Status-enum validation in `updateStatus`
- Pagination math (`skip`/`take` calculation, `totalPages` rounding)

### Integration Tests (Jest + Supertest, against a test database)
- Full auth flow: register → login → access a protected route with the returned token
- Project CRUD with ownership enforcement (two seeded users, cross-user access attempts)
- Task CRUD with creator/assignee permission checks
- Search scoping (confirm a user never receives another user's tasks in results)
- AI summary endpoint with a mocked Gemini client (both success and failure paths, asserting the fallback summary format)

### Why this split
Unit tests cover pure logic that doesn't need a database. Integration tests cover the authorization and data-scoping rules, which are the highest-risk area in this app — a missed ownership check is a real security bug, not just a missing feature, so that's where test coverage would add the most value first.

## Known Gaps

- No load/performance testing has been done. Pagination and indexing are in place, but no benchmarking has been run under concurrent load.
- No test database / CI pipeline is configured yet, so there's no automated check preventing a regression from being merged.
