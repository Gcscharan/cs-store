import fetch from "node-fetch";

async function testDeliveryLogin() {
  try {
    console.log("Testing delivery boy login...");

    const response = await fetch("http://localhost:5001/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "delivery@test.com",
        password: "123456",
      }),
    });

    const data = (await response.json()) as any;

    if (response.ok) {
      console.log("✅ Login successful!");
      console.log("User:", data.user);
      console.log("Access Token:", data.accessToken);

      // Test the delivery profile endpoint with this token
      console.log("\nTesting delivery profile endpoint...");
      const profileResponse = await fetch(
        "http://localhost:5001/api/delivery/profile",
        {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
          },
        }
      );

      const profileData = (await profileResponse.json()) as any;

      if (profileResponse.ok) {
        console.log("✅ Profile endpoint working!");
        console.log("Profile data:", profileData);
      } else {
        console.log("❌ Profile endpoint failed:", profileData);
      }

      // Test the selfie URL endpoint
      console.log("\nTesting selfie URL endpoint...");
      const selfieResponse = await fetch(
        "http://localhost:5001/api/delivery/selfie-url",
        {
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
          },
        }
      );

      const selfieData = (await selfieResponse.json()) as any;

      if (selfieResponse.ok) {
        console.log("✅ Selfie URL endpoint working!");
        console.log("Selfie data:", selfieData);
      } else {
        console.log("❌ Selfie URL endpoint failed:", selfieData);
      }
    } else {
      console.log("❌ Login failed:", data);
    }
  } catch (error) {
    console.error("Error testing delivery login:", error);
  }
}

testDeliveryLogin();
