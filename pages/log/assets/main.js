window.onload = get_recent_log();

function get_recent_log() {
    let recent = document.getElementsByClassName("recent").children;
    $.ajax({
        type: "POST",
        url: "/api",
        data: JSON.stringify({token: sessionStorage.getItem("token") || null, method: "get_recent_log"})
    }).done((j) => {
        let data = JSON.parse(j);
        if (data.error) {console.log(data.error)} // debugging
        if (data.token) {sessionStorage.setItem("token", data.token)}
        //for (var prop of data.content) {
        //    console.log(prop);
        //    //recent[Object.keys(prop)[0]].innerHTML = prop;
        //}
    })
}