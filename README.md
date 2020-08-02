# notu.dev
A website that happens to be about me. Source is here for my server, `auto_update.js` auto-updates the server whenever a new push on `master` branch.


|Server|Worker|API|
|---|---|---|
|handles page loading, and redirects api calls to the worker|handles token auth/loading, interacts between user & api|communicates between db/external apis and worker|