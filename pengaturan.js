
import { supabase } from "./supabase.js";

window.supabaseClient = supabase;
await import("./auth.js");

const Auth = window.Auth;
const $ = (id) => document.getElementById(id);

const passwordModal = $("passwordModal");
const passwordForm = $("passwordForm");
const passwordMessage = $("passwordMessage");
const logoutBtn = $("logoutBtn");
const changePasswordBtn = $("changePasswordBtn");

let currentUser = null;

function showMessage(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.classList.remove("success", "error");

  if (type) element.classList.add(type);
}

// TAB PENGATURAN
document.querySelectorAll(".settings-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.tab;

    document.querySelectorAll(".settings-tab").forEach((item) => {
      item.classList.toggle("active", item === tab);
    });

    document.querySelectorAll(".settings-panel").forEach((panel) => {
      const active = panel.id === `panel-${selected}`;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  });
});

/* ===== PREFERENSI TEMA ===== */

const themeOptions = document.querySelectorAll(".theme-option");
const themeMessage = $("themeMessage");
const themeStorageKey = "refoundry-theme";

function getSavedTheme() {
  try {
    return localStorage.getItem(themeStorageKey) || "light";
  } catch (error) {
    return "light";
  }
}

function applyTheme(theme) {
  const validThemes = ["light", "dark", "system"];

  if (!validThemes.includes(theme)) {
    theme = "light";
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.body.classList.toggle("dark-theme", isDark);

  themeOptions.forEach((button) => {
    const selected = button.dataset.theme === theme;

    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function saveTheme(theme) {
  try {
    localStorage.setItem(themeStorageKey, theme);
    applyTheme(theme);

    if (themeMessage) {
      themeMessage.textContent = "Preferensi tema berhasil disimpan.";
      themeMessage.classList.remove("error");
      themeMessage.classList.add("success");
    }
  } catch (error) {
    applyTheme(theme);

    if (themeMessage) {
      themeMessage.textContent =
        "Tema diterapkan, tetapi browser tidak dapat menyimpannya.";
      themeMessage.classList.remove("success");
      themeMessage.classList.add("error");
    }
  }
}

themeOptions.forEach((button) => {
  button.addEventListener("click", () => {
    saveTheme(button.dataset.theme);
  });
});

// Terapkan tema tersimpan saat halaman dibuka.
applyTheme(getSavedTheme());

// Perbarui otomatis jika pengguna memilih Ikuti Sistem.
const systemTheme = window.matchMedia(
  "(prefers-color-scheme: dark)"
);

systemTheme.addEventListener("change", () => {
  if (getSavedTheme() === "system") {
    applyTheme("system");
  }
});

// MEMUAT PROFIL
async function loadProfile() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    alert("Sesi login tidak ditemukan. Silakan login kembali.");
    window.location.replace("login.html");
    return false;
  }

  currentUser = data.user;

  const nameInput = $("profileName");
  const emailInput = $("profileEmail");

  if (nameInput) {
    nameInput.value =
      currentUser.user_metadata?.name ||
      currentUser.user_metadata?.full_name ||
      currentUser.email?.split("@")[0] ||
      "";
  }

  if (emailInput) emailInput.value = currentUser.email || "";

  return true;
}

// EDIT PROFIL
let originalName = "";
let editingProfile = false;

const editProfileBtn = $("editProfileBtn");
const cancelProfileBtn = $("cancelProfileBtn");
const profileName = $("profileName");
const profileMessage = $("profileMessage");

if (editProfileBtn && profileName) {
  editProfileBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    if (!editingProfile) {
      originalName = profileName.value;
      editingProfile = true;
      profileName.disabled = false;
      profileName.focus();
      editProfileBtn.textContent = "Simpan Profil";

      if (cancelProfileBtn) cancelProfileBtn.hidden = false;

      showMessage(profileMessage, "Ubah nama, lalu simpan.");
      return;
    }

    const newName = profileName.value.trim();

    if (!newName) {
      showMessage(profileMessage, "Nama tidak boleh kosong.", "error");
      return;
    }

    editProfileBtn.disabled = true;

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: newName }
      });

      if (error) throw error;

      originalName = newName;
      profileName.value = newName;
      finishProfileEdit();

      showMessage(profileMessage, "Profil berhasil diperbarui.", "success");
    } catch (error) {
      showMessage(
        profileMessage,
        error.message || "Gagal memperbarui profil.",
        "error"
      );
    } finally {
      editProfileBtn.disabled = false;
    }
  });
}

function finishProfileEdit() {
  editingProfile = false;

  if (profileName) profileName.disabled = true;
  if (editProfileBtn) editProfileBtn.textContent = "Edit Profil";
  if (cancelProfileBtn) cancelProfileBtn.hidden = true;
}

if (cancelProfileBtn) {
  cancelProfileBtn.addEventListener("click", () => {
    if (profileName) profileName.value = originalName;
    finishProfileEdit();
    showMessage(profileMessage, "Perubahan dibatalkan.");
  });
}



function closePasswordModal() {
  if (passwordModal) passwordModal.hidden = true;
  if (passwordForm) passwordForm.reset();
  showMessage(passwordMessage, "");
}

const cancelPasswordBtn = $("cancelPasswordBtn");

if (cancelPasswordBtn) {
  cancelPasswordBtn.addEventListener("click", closePasswordModal);
}

// SIMPAN KATA SANDI BARU
if (passwordForm) {
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser?.email) {
      showMessage(passwordMessage, "Silakan login kembali.", "error");
      return;
    }

    const oldPassword = $("oldPassword").value;
    const newPassword = $("newPassword").value;
    const confirmPassword = $("confirmPassword").value;

    if (newPassword.length < 8) {
      showMessage(passwordMessage, "Kata sandi minimal 8 karakter.", "error");
      return;
    }

    if (newPassword === oldPassword) {
      showMessage(
        passwordMessage,
        "Kata sandi baru harus berbeda dari kata sandi lama.",
        "error"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        passwordMessage,
        "Konfirmasi kata sandi tidak cocok.",
        "error"
      );
      return;
    }

    const submitButton = passwordForm.querySelector(
      'button[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Menyimpan...";
    }

    try {
      // Periksa kata sandi lama.
      const { error: verifyError } =
        await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: oldPassword
        });

      if (verifyError) {
        throw new Error("Kata sandi lama salah. Periksa kembali.");
      }

      // Perbarui kata sandi.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      showMessage(
        passwordMessage,
        "Kata sandi berhasil diperbarui!",
        "success"
      );

      passwordForm.reset();

      setTimeout(() => {
        closePasswordModal();
      }, 1200);
    } catch (error) {
      console.error("Gagal mengganti kata sandi:", error);

      showMessage(
        passwordMessage,
        error.message || "Gagal mengganti kata sandi.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Simpan";
      }
    }
  });
}

// LOGOUT
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    if (!confirm("Yakin ingin keluar dari akun Re:Foundry?")) return;

    logoutBtn.disabled = true;
    logoutBtn.textContent = "Keluar...";

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      window.location.replace("login.html");
    } catch (error) {
      console.error("Gagal logout:", error);

      alert("Logout gagal: " + (error.message || "Terjadi kesalahan."));

      logoutBtn.disabled = false;
      logoutBtn.textContent = "Logout";
    }
  });
}

// MULAI
try {
  if (Auth?.ready) await Auth.ready();

  const loggedIn = await loadProfile();
  if (!loggedIn) throw new Error("Pengguna belum login.");
} catch (error) {
  console.error("Pengaturan gagal dimuat:", error);
}
