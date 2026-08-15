import os
import sys
import hvac

def main():
    print("Setting up HashiCorp Vault...")
    client = hvac.Client(url="http://127.0.0.1:8200", token="my-root-token")
    
    # Verify connection
    if not client.is_authenticated():
        print("Vault not authenticated!")
        sys.exit(1)
        
    # Enable transit engine if not already enabled
    secrets_engines = client.sys.list_mounted_secrets_engines()
    if "transit/" not in secrets_engines:
        print("Enabling transit secrets engine...")
        client.sys.enable_secrets_engine("transit")
    else:
        print("Transit engine already enabled.")
        
    # Create vendor-data key
    print("Configuring vendor-data encryption key with derivation...")
    try:
        # Allow deletion first to enable clean recreation
        client.secrets.transit.update_key_configuration(name="vendor-data", deletion_allowed=True)
        client.secrets.transit.delete_key(name="vendor-data")
        print("Existing 'vendor-data' key deleted.")
    except Exception:
        pass
        
    client.secrets.transit.create_key(name="vendor-data", key_type="aes256-gcm96", derived=True)
    print("Key 'vendor-data' created with derived=True.")
        
    # Enable AppRole auth if not already enabled
    auth_methods = client.sys.list_auth_methods()
    if "approle/" not in auth_methods:
        print("Enabling AppRole authentication...")
        client.sys.enable_auth_method("approle")
    else:
        print("AppRole authentication already enabled.")
        
    # Configure backend policy
    policy_name = "backend-policy"
    policy_rules = """
    path "transit/keys/vendor-data"         { capabilities = ["read"] }
    path "transit/encrypt/vendor-data"      { capabilities = ["update"] }
    path "transit/decrypt/vendor-data"      { capabilities = ["update"] }
    path "transit/rewrap/vendor-data"       { capabilities = ["update"] }
    path "transit/rotate/vendor-data"       { capabilities = ["update"] }
    """
    client.sys.create_or_update_policy(name=policy_name, policy=policy_rules)
    print(f"Policy '{policy_name}' created/updated.")
    
    # Configure backend role
    role_name = "backend-app"
    client.write(f"auth/approle/role/{role_name}", policies=policy_name, token_ttl="15m", token_max_ttl="30m")
    print(f"AppRole '{role_name}' configured.")
    
    # Get role ID and secret ID
    role_id = client.read(f"auth/approle/role/{role_name}/role-id")["data"]["role_id"]
    secret_id = client.write(f"auth/approle/role/{role_name}/secret-id")["data"]["secret_id"]
    
    # Write environment setup instructions/variables to a temporary file for tests
    creds_path = os.path.join(os.path.dirname(__file__), "vault_test_creds.env")
    with open(creds_path, "w") as f:
        f.write(f"export VAULT_ADDR=http://127.0.0.1:8200\n")
        f.write(f"export VAULT_ROLE_ID={role_id}\n")
        f.write(f"export VAULT_SECRET_ID={secret_id}\n")
    print(f"Credentials written to {creds_path}")
    print("Vault setup successfully completed!")

if __name__ == "__main__":
    main()
