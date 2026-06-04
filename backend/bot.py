import discord
from discord import app_commands
from discord.ext import commands
import random
import urllib.request
import json
import re
import time
import os
import http.server
import socketserver
import threading

# Load configuration
config_path = os.path.join(os.path.dirname(__file__), "config.json")
try:
    with open(config_path, "r") as f:
        config = json.load(f)
except Exception as e:
    print(f"⚠️ Error loading config.json: {e}")
    config = {}

TOKEN = config.get("token", "")
RELAY_CHANNEL_ID = config.get("relay_channel_id", 0)
VERIFIED_ROLE_ID = config.get("verified_role_id", 0)
GUILD_ID = config.get("guild_id", 0)
FIREBASE_DB_URL = config.get("firebase_db_url", "https://area--12-default-rtdb.firebaseio.com")

# Verification Cache to hold pending verification requests
# Format: { "MTC-123456": { "discord_id": 1234, "username": "ziadlive", "tag": "24", "timestamp": 1780000000 } }
verification_cache = {}

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

def update_firebase_linking(username, discord_id, discord_tag, tag_number):
    """Updates Firebase Realtime Database with the verified Discord details."""
    username_lower = username.lower()
    
    # 1. Update /usernames/<username_lowercase>/discord
    url_discord = f"{FIREBASE_DB_URL}/usernames/{username_lower}/discord.json"
    discord_payload = {
        "discordId": str(discord_id),
        "discordTag": discord_tag
    }
    
    # 2. Update /usernames/<username_lowercase>/tagNumber
    url_tag = f"{FIREBASE_DB_URL}/usernames/{username_lower}/tagNumber.json"
    
    try:
        # Patch Discord details
        binary_data = json.dumps(discord_payload).encode('utf-8')
        req1 = urllib.request.Request(url_discord, data=binary_data, method="PUT")
        req1.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req1, timeout=10) as response:
            if response.status == 200:
                print(f"✅ Firebase: Discord mapping updated for {username}.")
                
        # Put Tag Number
        binary_tag = json.dumps(str(tag_number)).encode('utf-8')
        req2 = urllib.request.Request(url_tag, data=binary_tag, method="PUT")
        req2.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req2, timeout=10) as response:
            if response.status == 200:
                print(f"✅ Firebase: Tag number updated for {username} to [{tag_number}].")
                
    except Exception as e:
        print(f"❌ Failed to write linking data to Firebase: {e}")

class VerificationModal(discord.ui.Modal, title="MultiCraft Verification"):
    username = discord.ui.TextInput(
        label="MultiCraft In-Game Username",
        placeholder="e.g., ziadlive",
        required=True,
        min_length=3,
        max_length=15
    )
    tag_number = discord.ui.TextInput(
        label="In-Game Tag Number [#]",
        placeholder="e.g., 24",
        required=True,
        min_length=1,
        max_length=5
    )

    async def on_submit(self, interaction: discord.Interaction):
        username_val = self.username.value.strip()
        tag_val = self.tag_number.value.strip()
        
        # Verify tag is numeric
        if not tag_val.isdigit():
            await interaction.response.send_message("❌ Verification failed: Tag number must be digits only.", ephemeral=True)
            return

        # Generate unique code
        code = f"MTC-{random.randint(100000, 999999)}"
        
        # Store in verification cache
        verification_cache[code] = {
            "discord_id": interaction.user.id,
            "username": username_val,
            "tag": tag_val,
            "timestamp": time.time()
        }
        
        # Clear out expired cache entries (older than 10 minutes)
        now = time.time()
        expired = [k for k, v in verification_cache.items() if now - v["timestamp"] > 600]
        for k in expired:
            del verification_cache[k]
            
        instructions = (
            f"📥 **Verification Code Generated!**\n\n"
            f"**Username:** `{username_val}`\n"
            f"**In-Game Tag:** `[{tag_val}]`\n"
            f"**Your Verification Code:** `{code}`\n\n"
            f"👉 **Instructions:**\n"
            f"1. Log into your MultiCraft game server.\n"
            f"2. Type this exact code in the server chat: `{code}`\n"
            f"3. Wait for the bot to detect your chat and verify your account!"
        )
        await interaction.response.send_message(instructions, ephemeral=True)

class VerificationView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)  # Make it persistent

    @discord.ui.button(label="Link MultiCraft Account", style=discord.ButtonStyle.green, custom_id="mtc_verify_btn")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(VerificationModal())

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    print("------")
    # Register persistent view for the link button
    bot.add_view(VerificationView())
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"Failed to sync slash commands: {e}")

@bot.hybrid_command(name="verify", description="Link your MultiCraft (MTC) account to your Discord account.")
async def verify(ctx: commands.Context):
    """Slash/prefix command to start verification modal."""
    # This will prompt modal directly if slash command, otherwise instructions
    if ctx.interaction:
        await ctx.interaction.response.send_modal(VerificationModal())
    else:
        # Prefix command setup view
        view = VerificationView()
        embed = discord.Embed(
            title="🎮 MultiCraft Verification Portal",
            description=(
                "Click the button below to link your MultiCraft account and assign your player tag.\n\n"
                "**Why verify?**\n"
                "- Get your custom tag level `[#]` in your Discord name!\n"
                "- Receive the **Verified Player** role badge.\n"
                "- Show your Discord connection on the Area 12 index website."
            ),
            color=0x00ffff
        )
        await ctx.send(embed=embed, view=view)

@bot.command(name="setupverify", description="Post the persistent verify button embed (Admins only).")
@commands.has_permissions(administrator=True)
async def setupverify(ctx: commands.Context):
    """Sends the persistent verify embed button."""
    view = VerificationView()
    embed = discord.Embed(
        title="🎮 MultiCraft Account Association",
        description=(
            "Click the button below to link your MultiCraft (MTC) username with your Discord account.\n\n"
            "This will automatically synchronize your player name tag `[#]` and unlock verified privileges."
        ),
        color=0x00ffff
    )
    await ctx.send(embed=embed, view=view)
    await ctx.message.delete()

@bot.hybrid_command(name="sync", description="Synchronize all verified users' nicknames and roles from the database.")
@commands.has_permissions(administrator=True)
async def sync(ctx: commands.Context):
    """Synchronizes all linked accounts from Firebase to Discord."""
    await ctx.defer()
    
    url = f"{FIREBASE_DB_URL}/usernames.json"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                await ctx.send("❌ Error: Failed to fetch data from Firebase database.")
                return
            usernames_data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        await ctx.send(f"❌ Error connecting to database: {e}")
        return

    if not usernames_data:
        await ctx.send("ℹ️ No linked accounts found in the database.")
        return

    guild = ctx.guild
    if not guild:
        guild = bot.get_guild(GUILD_ID)
    if not guild:
        await ctx.send("❌ Error: Guild not found.")
        return

    role = guild.get_role(VERIFIED_ROLE_ID)
    if not role:
        await ctx.send("❌ Error: Verified role not found in the guild.")
        return

    synced_count = 0
    not_found_count = 0
    details = []

    for username_lower, data in usernames_data.items():
        if not isinstance(data, dict):
            continue
        
        discord_info = data.get("discord")
        tag = data.get("tagNumber")
        
        if not discord_info or tag is None:
            continue
            
        discord_id_str = discord_info.get("discordId")
        if not discord_id_str:
            continue
            
        try:
            discord_id = int(discord_id_str)
        except ValueError:
            continue

        username = data.get("displayName", username_lower)

        # Attempt to get member
        try:
            member = await guild.fetch_member(discord_id)
        except Exception:
            member = guild.get_member(discord_id)

        if not member:
            not_found_count += 1
            details.append(f"⚠️ **{username}**: Member with ID `{discord_id}` not in server.")
            continue

        # Sync role and nickname
        role_added = False
        nick_updated = False
        
        # 1. Check/Add Role
        if role not in member.roles:
            try:
                await member.add_roles(role)
                role_added = True
            except Exception as e:
                print(f"Sync: Failed to add role to {member.name}: {e}")
                
        # 2. Check/Update Nickname
        current_name = member.display_name
        clean_name = re.sub(r'\s*・\s*\[\d+\]$', '', current_name)
        clean_name = re.sub(r'\s*\[\d+\]$', '', clean_name)
        tag_suffix = f"・[{tag}]"
        max_clean_len = 32 - len(tag_suffix)
        if len(clean_name) > max_clean_len:
            clean_name = clean_name[:max_clean_len]
        new_nick = f"{clean_name}{tag_suffix}"
        
        if current_name != new_nick:
            try:
                await member.edit(nick=new_nick)
                nick_updated = True
            except Exception as e:
                print(f"Sync: Failed to update nickname for {member.name}: {e}")
                
        if role_added or nick_updated:
            synced_count += 1
            details.append(f"✅ **{username}** (<@{discord_id}>): Synced (Role: {'Yes' if role_added else 'No'}, Nickname: {'Yes' if nick_updated else 'No'})")
        else:
            # Already synced
            details.append(f"ℹ️ **{username}** (<@{discord_id}>): Already up-to-date")
            synced_count += 1

    summary_embed = discord.Embed(
        title="🔄 Synchronization Complete",
        description=f"Synced database records with server members.\n\n"
                    f"**Summary:**\n"
                    f"- Total synced/up-to-date: `{synced_count}`\n"
                    f"- Not in server: `{not_found_count}`",
        color=0x00ffff
    )
    
    details_str = "\n".join(details)
    if len(details_str) > 1024:
        details_str = details_str[:1000] + "\n... (truncated)"
    
    if details_str:
        summary_embed.add_field(name="Details", value=details_str, inline=False)
        
    await ctx.send(embed=summary_embed)

@bot.event
async def on_command_error(ctx: commands.Context, error: commands.CommandError):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("❌ You do not have permission to run this command.", ephemeral=True)
    else:
        print(f"Command error: {error}")

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.MissingPermissions):
        if interaction.response.is_done():
            await interaction.followup.send("❌ You do not have permission to run this command.", ephemeral=True)
        else:
            await interaction.response.send_message("❌ You do not have permission to run this command.", ephemeral=True)
    else:
        if interaction.response.is_done():
            await interaction.followup.send(f"❌ An error occurred: {error}", ephemeral=True)
        else:
            await interaction.response.send_message(f"❌ An error occurred: {error}", ephemeral=True)

@bot.event
async def on_message(message: discord.Message):
    # Process commands first
    await bot.process_commands(message)

    # Ignore messages from the bot itself
    if message.author.id == bot.user.id:
        return

    # Check if the message is in the relay channel
    if message.channel.id == RELAY_CHANNEL_ID:
        content = message.content.strip()
        
        # Check if the message contains an MTC verification code
        match = re.search(r"MTC-\d{6}", content)
        if match:
            code = match.group(0)
            if code in verification_cache:
                data = verification_cache[code]
                
                # Check if username is present in the relay message (case-insensitive)
                username_lower = data["username"].lower()
                msg_lower = content.lower()
                author_lower = message.author.name.lower()
                
                # Relays often send username as message prefix (e.g. "<username> text" or "username: text")
                # Webhook relays send username as the message author
                if username_lower in author_lower or username_lower in msg_lower:
                    discord_id = data["discord_id"]
                    username = data["username"]
                    tag = data["tag"]
                    
                    guild = message.guild
                    if not guild:
                        guild = bot.get_guild(GUILD_ID)
                        
                    if guild:
                        try:
                            member = await guild.fetch_member(discord_id)
                        except Exception:
                            # Try general query if fetch fails
                            member = guild.get_member(discord_id)
                            
                        if member:
                            # 1. Add verified role
                            role = guild.get_role(VERIFIED_ROLE_ID)
                            if role:
                                try:
                                    await member.add_roles(role)
                                    print(f"Role added to {member.name}")
                                except Exception as role_err:
                                    print(f"Could not assign role: {role_err}")
                            
                            # 2. Update Nickname (Format: Nickname・[Tag])
                            current_name = member.display_name
                            clean_name = re.sub(r'\s*・\s*\[\d+\]$', '', current_name)
                            clean_name = re.sub(r'\s*\[\d+\]$', '', clean_name)
                            tag_suffix = f"・[{tag}]"
                            max_clean_len = 32 - len(tag_suffix)
                            if len(clean_name) > max_clean_len:
                                clean_name = clean_name[:max_clean_len]
                            new_nick = f"{clean_name}{tag_suffix}"
                            
                            nick_success = True
                            try:
                                await member.edit(nick=new_nick)
                                print(f"Nickname updated to: {new_nick}")
                            except Exception as ne:
                                nick_success = False
                                print(f"Could not update nickname: {ne}")
                                
                            # 3. Write updates to Firebase Database
                            update_firebase_linking(username, discord_id, f"{member.name}#{member.discriminator}" if member.discriminator != "0" else member.name, tag)
                            
                            # Remove from verification cache
                            del verification_cache[code]
                            
                            # Send success confirmation in the channel
                            description_text = (
                                f"Successfully linked Discord user <@{discord_id}> to MultiCraft account **{username}**!\n"
                                f"Added player tag **[{tag}]** and role privileges."
                            )
                            if not nick_success:
                                description_text += (
                                    f"\n\n⚠️ **Nickname Update Failed:** I couldn't update your server nickname. "
                                    f"This happens if you are the **Server Owner** (Discord does not allow bots to change the owner's nickname) "
                                    f"or if the bot's role is below yours in the role hierarchy."
                                )
                                
                            success_embed = discord.Embed(
                                title="✅ Association Successful",
                                description=description_text,
                                color=0x00ff00
                            )
                            await message.channel.send(embed=success_embed)
                        else:
                            print(f"Error: Member with ID {discord_id} not found in guild.")
                else:
                    print(f"Received code {code} but sender username '{username_lower}' did not match relay message.")

class HealthCheckHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "healthy", "service": "LinkMTC Discord Bot"}')
        
    def log_message(self, format, *args):
        # Silence default web server logs
        return

def run_health_server():
    port_str = os.environ.get("PORT", "8000")
    try:
        port = int(port_str)
    except ValueError:
        port = 8000
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", port), HealthCheckHandler) as httpd:
            print(f"🚀 Health Check Server listening on port {port}...")
            httpd.serve_forever()
    except Exception as e:
        print(f"⚠️ Health Check Server failed to start: {e}")

if __name__ == "__main__":
    if not TOKEN or TOKEN == "YOUR_DISCORD_BOT_TOKEN_HERE":
        print("❌ Error: Please specify a valid Discord Bot token in config.json.")
    else:
        # Start health check server for hosting platforms (Render, Railway, Fly.io, etc.)
        health_thread = threading.Thread(target=run_health_server, daemon=True)
        health_thread.start()
        
        try:
            bot.run(TOKEN)
        except discord.errors.PrivilegedIntentsRequired:
            print("\n❌ Error: Privileged Intents Required!")
            print("Please enable 'Server Members Intent' and 'Message Content Intent' in the Discord Developer Portal:")
            print("1. Go to: https://discord.com/developers/applications/")
            print("2. Select your bot application (ID: 1512041885898641409)")
            print("3. Go to the 'Bot' tab in the left sidebar.")
            print("4. Scroll down to 'Privileged Gateway Intents'.")
            print("5. Enable both 'SERVER MEMBERS INTENT' and 'MESSAGE CONTENT INTENT'.")
            print("6. Click 'Save Changes' and run the bot again.\n")
        except Exception as e:
            print(f"❌ Error starting bot: {e}")
