import asyncio
from playwright.async_api import async_playwright
import time
import json

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Navigating to http://localhost:5175/")
        await page.goto("http://localhost:5175/")
        await page.wait_for_timeout(2000)

        print("Phase 1: Login and Navigate")
        # Click Sarah Jenkins (CISO) button
        try:
            await page.click("text=Sarah Jenkins")
            print("  Logged in as Sarah Jenkins")
        except Exception as e:
            print("  Login button not found or already logged in.", e)
        await page.wait_for_timeout(1000)
        
        # Click Vendors
        try:
            await page.click("text=Monitored Vendors")
        except Exception as e:
            await page.screenshot(path="error.png")
            print("Failed to find Vendors. Extracted text:")
            body_text = await page.evaluate("() => document.body.innerText")
            print(body_text.encode('ascii', 'ignore').decode('ascii'))
            raise e
        await page.wait_for_timeout(1000)
        
        await page.screenshot(path="dashboard_before_vendor.png")
        print("Clicking Atlassian...")
        await page.click("text=Atlassian")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="dashboard_after_vendor.png")

        print("Phase 2: Risk Assessment Tab")
        try:
            await page.click("text=Risk Assessment")
        except Exception as e:
            await page.screenshot(path="error_risk_assessment.png")
            raise e
        await page.wait_for_timeout(1000)

        # Click Start Assessment
        try:
            await page.click("button:has-text('Start Assessment')")
            print("  Started new assessment")
        except:
            try:
                await page.click("button:has-text('Resume')")
                print("  Resumed assessment")
            except:
                print("  Could not find Start or Resume button")
                # Maybe already open or completed.
        await page.wait_for_timeout(1000)

        print("Phase 3: Answer questions and Save Draft")
        
        # Fill out YES/NO questions
        yes_no_ids = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7']
        for qid in yes_no_ids:
            await page.locator(f"input[name='{qid}'][value='YES']").click(force=True)
            await page.wait_for_timeout(200)

        # Fill out multiple choice
        await page.select_option("select", "Annually")
        
        # Fill out text
        await page.fill("textarea", "AES-256 encryption used at rest and in transit.")
        
        await page.wait_for_timeout(500)
        
        print("Saving draft...")
        await page.click("button:has-text('Save Draft')")
        await page.wait_for_timeout(2000)
        
        print("Phase 4: Refresh and Verify Persistence")
        await page.reload()
        await page.wait_for_timeout(2000)
        
        # Open same vendor and tab again
        await page.click("text=Monitored Vendors")
        await page.wait_for_timeout(500)
        await page.click("text=Atlassian")
        await page.wait_for_timeout(500)
        await page.click("text=Risk Assessment")
        await page.wait_for_timeout(1000)
        
        print("  Checking if previous answers persisted")
        # Check if the radio button is still checked
        is_checked = await page.is_checked("input[name='q1'][value='YES']")
        print(f"  First question 'yes' checked: {is_checked}")
        
        print("Phase 5: Complete and Submit")
        # For simplicity, we just submit. Realistically, we'd answer all.
        print("  Submitting assessment")
        try:
            await page.click("button:has-text('Submit Assessment')")
            print("  Submitted assessment")
        except Exception as e:
            print("  Could not submit:", e)
        await page.wait_for_timeout(1000)
        
        print("Phase 6: Verification")
        text = await page.content()
        if 'SUBMITTED' in text or 'Submitted' in text:
            print("  Status is SUBMITTED")
        else:
            print("  Status not found in page content")
        
        if 'Risk Score' in text or 'Low' in text or 'Medium' in text or 'High' in text:
            print("  Risk Score/Level displayed")
        else:
            print("  Risk Score/Level not found")
            
        print("Phase 7: Storage Check")
        local_storage = await page.evaluate("() => JSON.stringify(window.localStorage)")
        print(f"  Local Storage: {local_storage}")
        
        session_storage = await page.evaluate("() => JSON.stringify(window.sessionStorage)")
        print(f"  Session Storage: {session_storage}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
