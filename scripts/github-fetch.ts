import { refreshJobs } from "../src/lib/refreshJobs";

refreshJobs()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Daily job refresh failed:", error);
    process.exitCode = 1;
  });
