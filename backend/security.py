from passlib.context import CryptContext

# Shared so that auth (verify on login) and profile (verify then rehash on
# password change) always use identical settings. Two separate CryptContext
# instances would be easy to let drift apart.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
