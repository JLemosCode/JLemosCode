const fs = require("node:fs");

const owner = process.env.GITHUB_REPOSITORY_OWNER || "JLemosCode";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");

const query = `
query($login:String!) {
  user(login:$login) {
    followers { totalCount }
    repositories(first:100, ownerAffiliations:OWNER, privacy:PUBLIC) { totalCount }
    contributionsCollection {
      contributionCalendar { totalContributions }
      totalCommitContributions
    }
  }
}`;

async function main() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "JLemosCode-profile"
    },
    body: JSON.stringify({query, variables:{login:owner}})
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const u = json.data.user;
  let svg = fs.readFileSync("assets/activity.svg", "utf8");
  const replacements = {
    'id="contributions" x="35" y="165" class="t" font-size="24">--':
      `id="contributions" x="35" y="165" class="t" font-size="24">${u.contributionsCollection.contributionCalendar.totalContributions.toLocaleString("en-US")}`,
    'id="repos" x="280" y="165" class="t" font-size="24">--':
      `id="repos" x="280" y="165" class="t" font-size="24">${u.repositories.totalCount}`,
    'id="followers" x="525" y="165" class="t" font-size="24">--':
      `id="followers" x="525" y="165" class="t" font-size="24">${u.followers.totalCount}`,
    'id="commits" x="770" y="165" class="t" font-size="24">--':
      `id="commits" x="770" y="165" class="t" font-size="24">${u.contributionsCollection.totalCommitContributions.toLocaleString("en-US")}`,
    'id="updated" x="120" y="240" class="t" font-size="11">waiting for GitHub Actions...':
      `id="updated" x="120" y="240" class="t" font-size="11">${new Date().toISOString()}`
  };
  for (const [a,b] of Object.entries(replacements)) svg = svg.replace(a,b);
  fs.writeFileSync("assets/activity.svg", svg);
  console.log(`Updated GitHub monitor for ${owner}`);
}
main().catch(e => { console.error(e); process.exit(1); });
