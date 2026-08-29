"""
Regression test suite for LinuxAI Command Runner.
Tests that command strings like 'su', 'whoami', 'pwd', 'ls', 'sudo whoami'
are preserved and executed faithfully without artificial rewriting.
"""
import pytest
import asyncio
from app.executor.runner import CommandRunner


@pytest.mark.asyncio
async def test_su_command_preservation():
    """Verify that 'su' is never mutated into 'bash -S'."""
    runner = CommandRunner()
    res = await runner.run(["su"], approved=True)
    assert res is not None
    assert "bash: -S: invalid option" not in res.stderr
    assert "bash: -S: invalid option" not in res.stdout
    assert res.command == "su"


@pytest.mark.asyncio
async def test_whoami_and_sudo_whoami():
    """Verify whoami and sudo whoami."""
    runner = CommandRunner()
    
    # Regular whoami
    res_user = await runner.run(["whoami"], approved=True)
    assert res_user.exit_code == 0
    assert "student" in res_user.stdout or "root" in res_user.stdout
    
    # sudo whoami
    res_root = await runner.run(["sudo", "whoami"], approved=True)
    assert res_root.exit_code == 0
    assert "root" in res_root.stdout


@pytest.mark.asyncio
async def test_pwd_and_ls():
    """Verify pwd and ls execution."""
    runner = CommandRunner()
    
    res_pwd = await runner.run(["pwd"], approved=True)
    assert res_pwd.exit_code == 0
    assert "/" in res_pwd.stdout
    
    res_ls = await runner.run(["ls"], approved=True)
    assert res_ls.exit_code == 0
    assert len(res_ls.stdout) > 0
