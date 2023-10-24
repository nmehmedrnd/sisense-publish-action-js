# Action to bring latest changes from remote branch
Currently there is sisense integration with github, but there is not piplines which to bring latest changes from staging to production and keep in tact staging production changes.
This action makes exactly that, it can be used in workflow to make needed requests to sisense API so that it can pull latest changes.

## Params
```yaml
token - Bearer token for sisense API
sisenseHost - Sisense host url with ending /
projectId - project id in sisense
branch - branch name (default to main)
```
