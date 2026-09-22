import socket
import subprocess
import re
import os

def get_local_ip():
    """Get the local IP address automatically"""
    try:
        # Windows
        output = subprocess.check_output(['ipconfig'], text=True)
        ip_pattern = r'IPv4 Address[.\s]+:\s+(\d+\.\d+\.\d+\.\d+)'
        ips = re.findall(ip_pattern, output)
        
        # Filter out VMware and other virtual adapters
        valid_ips = []
        for ip in ips:
            if not ip.startswith('127.') and not ip.startswith('169.254.'):
                if not ip.startswith('192.168.11.') and not ip.startswith('192.168.252.'):
                    valid_ips.append(ip)
        
        if valid_ips:
            return valid_ips[0]
    except:
        pass
    
    try:
        # Mac/Linux
        output = subprocess.check_output(['ifconfig'], text=True)
        ip_pattern = r'inet (\d+\.\d+\.\d+\.\d+)'
        ips = re.findall(ip_pattern, output)
        valid_ips = [ip for ip in ips if not ip.startswith('127.')]
        if valid_ips:
            return valid_ips[0]
    except:
        pass
    
    return None

def update_env_files(ip):
    """Update ALL .env files with the new IP"""
    base_path = os.path.join(os.path.dirname(__file__), '..')
    
    # List of all .env files to update
    env_files = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.production'
    ]
    
    for env_file in env_files:
        env_path = os.path.join(base_path, env_file)
        
        # Only update if file exists
        if os.path.exists(env_path):
            with open(env_path, 'w') as f:
                f.write(f'EXPO_PUBLIC_API_URL=http://{ip}:5000\n')
                f.write(f'EXPO_PUBLIC_API_TIMEOUT=30000\n')
                f.write(f'EXPO_PUBLIC_MAX_RETRIES=3\n')
                f.write(f'EXPO_PUBLIC_DEBUG=true\n')
            print(f'✅ Updated {env_file} with IP: {ip}')
        else:
            print(f'⚠️ {env_file} not found, skipping...')

if __name__ == "__main__":
    print('=' * 50)
    print('🔄 Auto-Detecting IP Address...')
    print('=' * 50)
    
    ip = get_local_ip()
    
    if ip:
        print(f'📡 Detected IP: {ip}')
        update_env_files(ip)
        print('\n✅ All .env files updated successfully!')
        print(f'📱 Your app will connect to: http://{ip}:5000')
        print('\n🔄 Restart Expo: npx expo start --clear')
    else:
        print('❌ Could not detect IP address')
        print('   Please run ipconfig manually and update .env files')
    
    print('=' * 50)