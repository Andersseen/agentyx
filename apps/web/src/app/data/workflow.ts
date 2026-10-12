export const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Initialize",
    description:
      "Detect your stack and agents, choose packs, and install the first setup interactively.",
    command: "pnpm dlx @agentyx/cli init",
  },
  {
    number: "02",
    title: "Tune your capabilities",
    description: "Add packs or enable optional capabilities as your project changes.",
    command: "pnpm dlx @agentyx/cli configure",
  },
  {
    number: "03",
    title: "Sync the agents",
    description: "Converge provider files on the desired project configuration.",
    command: "pnpm dlx @agentyx/cli sync",
  },
  {
    number: "04",
    title: "Check the setup",
    description: "Review health, installed-state drift and available usage evidence.",
    command: "pnpm dlx @agentyx/cli doctor",
  },
];
