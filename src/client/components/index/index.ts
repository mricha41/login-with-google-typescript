import "./css/styles.css";

document.addEventListener("DOMContentLoaded", async () => {

    let app = document.getElementById("app") as HTMLDivElement;

    app.insertAdjacentHTML("afterbegin", `
        <header id="main-header">
            <a class="nav-link" href="/" data-page-label="index" id="branding" title="Home">Home</a>
            <nav>
                <div id="sign-in">
                    <div class="sign-in-option">
                        <a id="sign-in-with-google" href="/auth/google">Login with Google</a>
                    </div>
                </div>
                <div id="user-profile" class="hidden"></div>
                <div>
                    <div class="menu-tab">
                        <a class="github-link" href="https://github.com/mricha41/login-with-google-typescript" target="_blank">
                            Github
                        </a>
                    </div>
                </div>
            </nav>
        </header>
        <main><h1 id="sign-in-message"></h1></main>
    `);

    let signin_message = document.getElementById("sign-in-message") as HTMLHeadingElement;
    signin_message.innerText = "";
    signin_message.insertAdjacentText("afterbegin", `Howdy stranger, sign in to Google. Please and thank you.`);

    const csrf = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrf?.getAttribute('content') as string;

    const user = await fetch('/auth/google/user');

    if (user.ok) {
        
        try {

            const user_data = await user.json();
            const signin = document.querySelector("#sign-in") as HTMLDivElement;
            if (!signin.classList.contains('hidden'))
                signin.classList.add("hidden");
            
            const user_profile = document.querySelector("#user-profile") as HTMLDivElement;
            if (user_profile.classList.contains("hidden"))
                user_profile.classList.remove("hidden");

            user_profile.insertAdjacentHTML("afterbegin", `
                <label>Hello, ${user_data.display_name}!</label>
                <form action="/auth/google/logout" method="post">
                    <button id="logout" type="submit">Sign out</button>
                    <input type="hidden" name="_csrf" value="${csrfToken}">
                </form>
            `);
            
            signin_message.innerText = "";
            signin_message.insertAdjacentText("afterbegin", `Thank you, ${user_data.display_name}! Ya did good 👍 ...'kay you can sign out now.`)

        } catch (error) {
            console.log(error)
        }

    }

});
