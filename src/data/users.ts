export type DemoUser = {
  email: string;
  password: string;
  name: string;
  role: string;
  initials: string;
};

export const demoUsers: DemoUser[] = [
  {
    email: "demo@fieldnotes.local",
    password: "demo1234",
    name: "Mina Park",
    role: "Product designer",
    initials: "MP",
  },
  {
    email: "admin@fieldnotes.local",
    password: "admin1234",
    name: "Theo James",
    role: "Workspace admin",
    initials: "TJ",
  },
];
