# V2 architecture

## Overview

Trophy Backlog is a local application with two workspace packages:

- `apps/web`: the React user interface
- `apps/api`: the local API, persistence layer, and external-service adapters

The browser communicates only with the local API. External credentials and
external-service requests must never be placed in browser code.

## Data flow

```text
React interface
      |
      | /api
      v
Local Express API
      |
      +-- SQLite repository
      +-- backup and restore service
      +-- PlayStation read adapter
      +-- metadata provider adapter
```
