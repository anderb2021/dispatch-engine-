const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Provider 1
  await prisma.user.create({
    data: {
      name: "Plumber A",
      phoneNumber: "+12014075804",
      role: "PROVIDER",
      providers: {
        create: {
          serviceArea: "District 1",
        },
      },
    },
  });

  // Provider 2
  await prisma.user.create({
    data: {
      name: "Plumber B",
      phoneNumber: "+19173106051",
      role: "PROVIDER",
      providers: {
        create: {
          serviceArea: "District 3",
        },
      },
    },
  });

  // Provider 3
  await prisma.user.create({
    data: {
      name: "Plumber C",
      phoneNumber: "+12014075804",
      role: "PROVIDER",
      providers: {
        create: {
          serviceArea: "District 3",
        },
      },
    },
  });

  console.log("Providers seeded successfully!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
