
(function () {
  "use strict";

  var currentUser = null;
  var authReady;

  function formatUser(user) {
    if (!user) return null;

    return {
      id: user.id,
      name:
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Pengguna",
      email: user.email,
      role: user.app_metadata?.role === "admin" ? "admin" : "user"
    };
  }

  function getClient() {
    if (!window.supabaseClient) {
      throw new Error(
        "Koneksi Supabase belum tersedia. Periksa supabase.js."
      );
    }

    return window.supabaseClient;
  }

  async function refreshUser() {
    var client = getClient();
    var result = await client.auth.getUser();

    if (result.error || !result.data.user) {
      currentUser = null;
      return null;
    }

    currentUser = formatUser(result.data.user);
    return currentUser;
  }

  authReady = (async function () {
    try {
      var client = getClient();

      client.auth.onAuthStateChange(function (_event, session) {
        currentUser = formatUser(session?.user || null);
      });

      return await refreshUser();
    } catch (error) {
      console.error("Auth initialization error:", error);
      return null;
    }
  })();

  window.Auth = {
    ready: function () {
      return authReady;
    },

    current: function () {
      return currentUser;
    },

    isAdmin: function () {
      return !!currentUser && currentUser.role === "admin";
    },

    logout: async function () {
      var client = getClient();
      var result = await client.auth.signOut();

      if (result.error) throw result.error;

      currentUser = null;
    },

    updateName: async function (name) {
      name = (name || "").trim();

      if (name.length < 3) {
        throw new Error("Nama lengkap minimal 3 karakter.");
      }

      var client = getClient();

      var result = await client.auth.updateUser({
        data: { name: name }
      });

      if (result.error) {
        throw new Error(
          "Nama gagal diperbarui: " + result.error.message
        );
      }

      currentUser = formatUser(result.data.user);

      return currentUser;
    },

    verify: async function (password) {
      if (!currentUser || !password) return false;

      var client = getClient();

      var result = await client.auth.signInWithPassword({
        email: currentUser.email,
        password: password
      });

      return !result.error;
    },

    register: async function (name, email, password, passwordConfirm) {
      name = (name || "").trim();
      email = (email || "").trim().toLowerCase();

      if (name.length < 3) {
        throw new Error("Nama lengkap minimal 3 karakter.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Format email tidak valid.");
      }

      if (!password || password.length < 6) {
        throw new Error("Password minimal 6 karakter.");
      }

      if (password !== passwordConfirm) {
        throw new Error("Konfirmasi password tidak sama.");
      }

      var client = getClient();

      var result = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { name: name }
        }
      });

      if (result.error) {
        console.error("Register error:", result.error);
        throw new Error(result.error.message);
      }

      currentUser = result.data.session
        ? formatUser(result.data.user)
        : null;

      return {
        ...(formatUser(result.data.user) || {}),
        needsEmailConfirmation: !result.data.session
      };
    },

    login: async function (email, password) {
      email = (email || "").trim().toLowerCase();

      if (!email || !password) {
        throw new Error("Email dan password wajib diisi.");
      }

      var client = getClient();

      var result = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (result.error) {
        console.error("Login error:", result.error);
        throw new Error(result.error.message);
      }

      currentUser = formatUser(result.data.user);

      return currentUser;
    }
  };
})();
