# Common passwords rejected at registration (case-insensitive).
# Length + blocklist follows NIST SP 800-63B — complexity rules push users
# toward predictable patterns like Password1!.

BLOCKLIST: frozenset[str] = frozenset(
    {
        "password",
        "12345678",
        "123456789",
        "1234567890",
        "qwerty",
        "qwerty123",
        "letmein",
        "monkey",
        "dragon",
        "baseball",
        "iloveyou",
        "trustno1",
        "sunshine",
        "princess",
        "football",
        "shadow",
        "master",
        "welcome",
        "login",
        "admin",
        "passw0rd",
        "password1",
        "password123",
        "abc123",
        "11111111",
        "00000000",
        "superman",
        "batman",
        "access",
        "hello123",
        "freedom",
        "whatever",
        "qazwsx",
        "654321",
        "987654321",
        "starwars",
        "ashley",
        "michael",
        "jennifer",
        "computer",
        "internet",
        "secret",
        "changeme",
        "test1234",
        "guest",
        "root",
        "toor",
        "pass1234",
        "default",
    }
)


def is_blocklisted(password: str) -> bool:
    return password.lower() in BLOCKLIST
