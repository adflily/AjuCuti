"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { loginAction } from "@/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const fromPath = searchParams.get("from") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    identifier: "",
    password: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    document.title = "Masuk — AjuCuti";
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setFieldErrors({ identifier: "", password: "" });

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await loginAction(null, formData);

      if (result) {
        setErrorMessage(result.error || "");
        setFieldErrors({
          identifier: result.fieldErrors?.identifier || "",
          password: result.fieldErrors?.password || "",
        });
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Header identitas aplikasi */}
        <div className="text-center mb-6 sm:mb-8">
          <Image
            src="/logo.png"
            alt="Logo AjuCuti"
            width={64}
            height={64}
            className="mx-auto mb-3 h-16 w-16 object-contain"
            priority
          />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            AjuCuti
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sistem Manajemen Cuti Karyawan
          </p>
        </div>

        {/* Kartu formulir login */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Masuk ke Akun Anda
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan email atau username terdaftar untuk melanjutkan.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="from" value={fromPath} />

            {/* Input email atau username */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email atau Username
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                disabled={isPending}
                placeholder="contoh: andi@ajucuti.local atau andi"
                aria-invalid={Boolean(fieldErrors.identifier)}
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100 disabled:text-slate-500"
              />
              {fieldErrors.identifier && (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            {/* Input kata sandi dengan tombol toggle lihat/sembunyikan */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  placeholder="Masukkan kata sandi"
                  aria-invalid={Boolean(fieldErrors.password)}
                  className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-3.5 pr-12 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isPending}
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Lihat kata sandi"
                  }
                  className="absolute inset-y-0 right-0 flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-500 hover:text-slate-700 focus:outline-none focus:text-blue-600"
                >
                  {showPassword ? (
                    /* Ikon mata tertutup */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Ikon mata terbuka */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Checkbox Ingat saya */}
            <div className="flex items-center">
              <label
                htmlFor="remember"
                className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none text-sm text-slate-700"
              >
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Ingat saya (30 hari)</span>
              </label>
            </div>

            {/* Tombol submit dengan loading state */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} AjuCuti &mdash; Sistem Manajemen Cuti Karyawan
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <p className="text-sm text-slate-500">Memuat halaman masuk AjuCuti...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}