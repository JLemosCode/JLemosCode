const fs = require("node:fs");
const path = require("node:path");

const owner = process.env.GITHUB_REPOSITORY_OWNER || "JLemosCode";
const token = process.env.GITHUB_TOKEN;

if (!token) throw new Error("GITHUB_TOKEN is required");

const query = `
query($login:String!) {
  user(login:$login) {
    login
    name
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
      totalCount
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { contributionCount date }
        }
      }
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
    }
  }
}`;

async function githubGraphQL() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "JLemosCode-profile"
    },
    body: JSON.stringify({ query, variables: { login: owner } })
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data.user;
}

function esc(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function updateActivity(user) {
  const file = path.join("assets", "activity.svg");
  let svg = fs.readFileSync(file, "utf8");
  const cal = user.contributionsCollection.contributionCalendar;
  const total = cal.totalContributions;
  const repos = user.repositories.totalCount;
  const followers = user.followers.totalCount;

  // RPG-like GitHub level: a transparent metric derived only from GitHub activity.
  const xp = total * 10 + user.contributionsCollection.totalRepositoryContributions * 250;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
  const next = level * level * 100;
  const prev = (level - 1) * (level - 1) * 100;
  const progress = Math.max(0, Math.min(1, (xp - prev) / Math.max(1, next - prev)));

  svg = svg
    .replace('>--</text>\n<text x="55" y="125"', `>${esc(total.toLocaleString("en-US"))}</text>\n<text x="55" y="125"`)
    .replace('>--</text>\n<text x="310" y="125"', `>${esc(repos.toLocaleString("en-US"))}</text>\n<text x="310" y="125"`)
    .replace('>--</text>\n<text x="565" y="125"', `>${esc(followers.toLocaleString("en-US"))}</text>\n<text x="565" y="125"`)
    .replace('>LVL --</text>', `>LVL ${level}</text>`)
    .replace('width="520" height="24"', `width="${Math.max(10, Math.round(1065 * progress))}" height="24"`)
    .replace('>XP -- / --</text>', `>XP ${xp.toLocaleString("en-US")} / ${next.toLocaleString("en-US")}</text>`);

  // Draw the last 12 weeks as a compact contribution grid.
  const days = cal.weeks.flatMap(w => w.contributionDays);
  const recent = days.slice(-84);
  const max = Math.max(1, ...recent.map(d => d.contributionCount));
  const cells = recent.map((d, i) => {
    const x = (i % 42) * 25;
    const y = Math.floor(i / 42) * 25;
    const ratio = d.contributionCount / max;
    const opacity = d.contributionCount === 0 ? 0.10 : 0.25 + ratio * 0.75;
    return `<rect x="${x}" y="${y}" width="18" height="18" rx="4" fill="#FF3CAC" fill-opacity="${opacity.toFixed(2)}"><title>${d.date}: ${d.contributionCount} contributions</title></rect>`;
  }).join("");

  svg = svg.replace('<g id="grid" transform="translate(55,245)"></g>', `<g id="grid" transform="translate(55,245)">${cells}</g>`);
  fs.writeFileSync(file, svg);
}

async function main() {
  const user = await githubGraphQL();
  updateActivity(user);

  const stamp = new Date().toISOString();
  fs.writeFileSync("assets/.last-update", stamp + "\n");
  console.log(`Updated profile telemetry for ${user.login} at ${stamp}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
