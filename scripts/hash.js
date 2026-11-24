// Skrip utilitas lokal untuk menghasilkan hash bcrypt asli bagi database/seed.sql.
// Cara pakai: node scripts/hash.js Password123!
// Catatan: jika package.json memakai "type": "module", ubah require menjadi:
// import bcrypt from "bcryptjs";

const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

async function main() {
  const plainPassword = process.argv[2];

  if (!plainPassword) {
    console.error("Gagal: masukkan password sebagai argumen.");
    console.error("Contoh: node scripts/hash.js Password123!");
    process.exit(1);
  }

  if (plainPassword.length < 8) {
    console.error("Gagal: password minimal 8 karakter.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  console.log("\nHash bcrypt berhasil dibuat (salin baris di bawah ini):\n");
  console.log(hash);
  console.log("");
}

main().catch((error) => {
  console.error("Terjadi kesalahan saat membuat hash:", error.message);
  process.exit(1);
});