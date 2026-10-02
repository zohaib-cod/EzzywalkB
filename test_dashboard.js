async function test() {
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alizohaib.web@gmail.com', password: 'password' })
  });
  console.log("Login Status:", loginRes.status);
}
test();
