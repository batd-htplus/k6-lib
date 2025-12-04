import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting seed...");

    console.log("🗑️  Clearing existing data...");
    await prisma.post.deleteMany();
    await prisma.tokenBlacklist.deleteMany();
    await prisma.user.deleteMany();

    console.log("👥 Creating 150 users...");
    const users = [];
    const hashedPassword = await bcrypt.hash("password123", 10);

    for (let i = 1; i <= 150; i++) {
        const user = await prisma.user.create({
            data: {
                email: `user${i}@example.com`,
                password: hashedPassword,
            },
        });
        users.push(user);
        if (i % 50 === 0) {
            console.log(`   Created ${i}/150 users`);
        }
    }
    console.log("✅ Created 150 users");

    console.log("📝 Creating 5000 posts...");
    const totalPosts = 5000;
    const postsPerUser = Math.floor(totalPosts / users.length);
    const remainingPosts = totalPosts % users.length;

    let postCount = 0;
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const postsToCreate = postsPerUser + (i < remainingPosts ? 1 : 0);

        for (let j = 0; j < postsToCreate; j++) {
            await prisma.post.create({
                data: {
                    title: `Post ${postCount + 1} by ${user.email}`,
                    content: `This is the content of post number ${postCount + 1} created by user ${user.email}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
                    authorId: user.id,
                },
            });
            postCount++;
        }

        if ((i + 1) % 25 === 0) {
            console.log(`   Created ${postCount}/${totalPosts} posts`);
        }
    }
    console.log("✅ Created 5000 posts");

    console.log("🎉 Seed completed successfully!");
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Posts: ${postCount}`);
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

